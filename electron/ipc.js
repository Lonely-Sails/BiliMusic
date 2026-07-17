/**
 * IPC 处理器 — 注册所有 ipcMain.handle/on 通道
 *
 * 按领域分为：Session、搜索、音乐中心、播放、认证、收藏、
 * 歌词获取、本地歌词文件操作、歌词编辑器、桌面歌词、窗口控制、缓存
 *
 * 设计原则：
 * - 所有 API 调用统一由后端（主进程）发起，前端仅通过 IPC 获取结果
 * - 简单 handler 通过 `simpleHandlers` 对象批量注册，减少样板代码
 * - 复杂 handler（如 lyric:get 编排式获取）单独实现
 */

import { ipcMain, app, shell, BrowserWindow, net } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { logger } from './utils/logger.js'
import { loadSession, apiGet, parseSetCookie, getSession } from './api/client.js'
import { getResponseCacheStats, clearResponseCache, setResponseCacheMax } from './api/cache.js'
import { searchVideo, getSearchSuggest, getHotSearch } from './api/search.js'
import { getVideoInfo, getAudioUrl } from './api/video.js'
import { getQrcode, pollLogin, completeLogin, checkLogin, logout, saveSession, clearAuth } from './api/auth.js'
import { listFavFolders, listFavResources, addFav, removeFav } from './api/fav.js'
import {
  /* getBilibiliSubtitle, */ searchCandidates, searchRankedCandidates,
  /* alignFirstLine, autoAlignAll, */ fetchLyric, parseLRC, mergeTranslations
} from './api/lyric.js'
import { getPopular } from './api/popular.js'
import { getMusicBanner, getHotToplist, getHotRank, getNewMusic, getComprehensiveRank } from './api/musicCenter.js'

export function setupIPC(wm, currentLyricsData, currentTrackInfo) {
  const { getMainWindow, isMainWindowAlive, getDesktopLyricsWindow, isDesktopLyricsAlive, notifyMain } = wm

  // ══════════════════════════════════════════
  //  内部工具函数
  // ══════════════════════════════════════════

  /** 获取本地歌词存储目录（userData/lyrics），不存在则创建 */
  function getLyricsDir() {
    const dir = join(app.getPath('userData'), 'lyrics')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
  }

  function findLocalLyric(title, bvid) {
    if (!title && !bvid) return null
    const dir = getLyricsDir()
    const files = readdirSync(dir).filter(f => f.endsWith('.lrc'))
    const keyword = title?.toLowerCase() || ''
    for (const file of files) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8')
        const lines = content.split('\n')
        if (bvid) {
          const bvidLine = lines.find(l => l.startsWith('[bvid:'))
          const fileBvid = bvidLine ? bvidLine.replace('[bvid:', '').replace(']', '').trim() : ''
          if (fileBvid && fileBvid === bvid) {
            const lyrics = parseLRC(content)
            if (lyrics.length > 0) return lyrics
          }
        }
        if (title) {
          const tiLine = lines.find(l => l.startsWith('[ti:'))
          const songTitle = tiLine ? tiLine.replace('[ti:', '').replace(']', '').trim() : file.replace('.lrc', '')
          if (songTitle.toLowerCase().includes(keyword) || keyword.includes(songTitle.toLowerCase())) {
            const lyrics = parseLRC(content)
            if (lyrics.length > 0) return lyrics
          }
        }
      } catch { /* skip */ }
    }
    return null
  }

  function extractSearchKeyword(videoInfo, fallbackTitle) {
    if (videoInfo?.bgm_info?.music_title) {
      const bgmTitle = videoInfo.bgm_info.music_title
        .replace(/^发现/, '').replace(/[《》【】「」]/g, '').trim()
      if (bgmTitle) return bgmTitle
    }
    if (videoInfo?.title) {
      for (const p of [/《(.+?)》/, /【(.+?)】/, /「(.+?)」/, /"(.+?)"/]) {
        const m = videoInfo.title.match(p)
        if (m) return m[1].trim()
      }
      return videoInfo.title.trim()
    }
    return fallbackTitle?.trim() || ''
  }

  // ══════════════════════════════════════════
  //  初始化 B站 Session（buvid 指纹 + 登录态检测）
  //  确保 API 请求有合法的 Cookie 环境
  // ══════════════════════════════════════════

  async function ensureBiliSession() {
    try {
      const fp = await apiGet('https://api.bilibili.com/x/frontend/finger/spi')
      if (fp.code === 0 && fp.data) {
        const cookies = getSession().cookies
        if (fp.data.b_3 && !cookies.find(c => c.name === 'buvid3'))
          parseSetCookie([`buvid3=${fp.data.b_3}; path=/; domain=.bilibili.com`])
        if (fp.data.b_4 && !cookies.find(c => c.name === 'buvid4'))
          parseSetCookie([`buvid4=${fp.data.b_4}; path=/; domain=.bilibili.com`])
      }
    } catch (e) { logger.warn('Fingerprint fetch failed:', e) }
    try {
      const navResp = await apiGet('https://api.bilibili.com/x/web-interface/nav')
      if (navResp.code === 0 && navResp.data) {
        return { loggedIn: !!navResp.data.isLogin, uid: navResp.data.mid || '', nickname: navResp.data.uname || '', avatar: navResp.data.face || '' }
      }
    } catch (e) { logger.warn('Nav check failed:', e) }
    return { loggedIn: false, uid: '', nickname: '', avatar: '' }
  }

  ipcMain.handle('session:ensure', async () => {
    try { return await ensureBiliSession() }
    catch (e) { return { loggedIn: false, error: e.message } }
  })

  // ══════════════════════════════════════════
  //  Session / 搜索 / 音乐中心 — 批量注册简单 handler
  //  这些 handler 只是调用 API 函数并包装错误，结构完全一致
  // ══════════════════════════════════════════

  const simpleHandlers = {
    'search:video': (_, keyword, page) => searchVideo(keyword, page || 1),
    'search:suggest': (_, term) => getSearchSuggest(term),
    'search:hot': () => getHotSearch(),
    'popular:get': (_, pn) => getPopular(pn || 1),
    'music:banner': () => getMusicBanner(),
    'music:hot-toplist': () => getHotToplist(),
    'music:hot-rank': () => getHotRank(),
    'music:new-music': () => getNewMusic(),
    'music:comprehensive-rank': (_, pn, ps) => getComprehensiveRank(pn || 1, ps || 20),
  }
  for (const [channel, handler] of Object.entries(simpleHandlers)) {
    ipcMain.handle(channel, async (...args) => {
      try { return await handler(...args) }
      catch (e) { return { error: e.message } }
    })
  }

  // ══════════════════════════════════════════
  //  播放器 — 获取视频信息和音频流 URL
  // ══════════════════════════════════════════

  ipcMain.handle('player:get-video-info', async (_, bvid, aid) => {
    try { return await getVideoInfo(bvid, aid) }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('player:get-audio-url', async (_, bvid, cid) => {
    try { return await getAudioUrl(bvid, cid) }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('player:get-audio-buffer', async (_, url) => {
    try {
      const response = await net.fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.bilibili.com'
        }
      })
      const buffer = await response.arrayBuffer()
      return Buffer.from(buffer)
    } catch (e) { return { error: e.message } }
  })

  // ══════════════════════════════════════════
  //  认证 — 二维码登录、登出、session 管理
  // ══════════════════════════════════════════

  ipcMain.handle('auth:get-qrcode', async () => {
    try { return await getQrcode() }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('auth:clear', async () => {
    try { clearAuth(); return { success: true } }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('auth:poll-login', async (_, qrcodeKey) => {
    try {
      const result = await pollLogin(qrcodeKey)
      if (result.status === 'success') {
        await completeLogin(result.url)
        saveSession(global.__SESSION_PATH)
        logger.info('Login completed')
      }
      return result
    } catch (e) { return { error: e.message } }
  })
  ipcMain.handle('auth:check-login', async () => {
    try { return await checkLogin() }
    catch { return { loggedIn: false } }
  })
  ipcMain.handle('auth:logout', async () => {
    try { return await logout() }
    catch (e) { return { error: e.message } }
  })

  // ══════════════════════════════════════════
  //  收藏夹 — 列表、增删
  // ══════════════════════════════════════════


  ipcMain.handle('fav:list-folders', async (_, upMid) => {
    try { return await listFavFolders(upMid) }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('fav:list-resources', async (_, mediaId, page, upMid) => {
    try { return await listFavResources(mediaId, page || 1, 20, upMid) }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('fav:add', async (_, bvid, mediaId) => {
    try { return await addFav(bvid, mediaId) }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('fav:remove', async (_, bvid, mediaId) => {
    try { return await removeFav(bvid, mediaId) }
    catch (e) { return { error: e.message } }
  })

  // ══════════════════════════════════════════
  //  歌词获取 — 编排式获取（本地LRC → 在线搜索）
  //  优先级：
  //    1. 本地已保存的 LRC 文件
  //    2. 第三方源（QQ/网易云），按相似度排序取最优
  //    （B站 AI 字幕已禁用）
  // ══════════════════════════════════════════

  ipcMain.handle('lyric:get', async (_, bvid, cid, title) => {
    try {
      let videoInfo = null
      if (bvid) { try { videoInfo = await getVideoInfo(bvid, null) } catch {} }
      const keyword = extractSearchKeyword(videoInfo, title)

      if (keyword || bvid) {
        const local = findLocalLyric(keyword, bvid)
        if (local) return { source: 'local', lyrics: local }
      }
      // B站字幕已禁用
      // if (bvid && cid) {
      //   const sub = await getBilibiliSubtitle(bvid, cid)
      //   if (sub?.length > 0) return { source: 'subtitle', lyrics: sub, hasSubtitle: true }
      // }
      if (keyword) {
        const ranked = await searchRankedCandidates(keyword, videoInfo?.title || keyword, videoInfo?.author)
        const successful = []
        for (const c of ranked) {
          const result = await fetchLyric(c.source, c.id)
          if (result) {
            if (result.trans?.length) result.lyrics = mergeTranslations(result.lyrics, result.trans)
            successful.push({ ...result, candidate: c })
          }
        }
        if (successful.length > 0) {
          successful.sort((a, b) => {
            const scoreDiff = (b.candidate?.score || 0) - (a.candidate?.score || 0)
            if (scoreDiff !== 0) return scoreDiff
            // 分数相同时，优先采用有翻译的
            const aTrans = a.trans?.length > 0 ? 1 : 0
            const bTrans = b.trans?.length > 0 ? 1 : 0
            return bTrans - aTrans
          })
          return successful[0]
        }
      }
      return { source: 'none', lyrics: [] }
    } catch (e) {
      logger.error('lyric:get failed:', e.message)
      return { error: e.message }
    }
  })

  ipcMain.handle('lyric:search-candidates', async (_, title) => {
    try { return await searchCandidates(title) }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('lyric:search-ranked', async (_, keyword, videoTitle, author) => {
    try { return await searchRankedCandidates(keyword, videoTitle, author) }
    catch (e) { return { error: e.message } }
  })
  // B站字幕已禁用
  // ipcMain.handle('lyric:get-subtitle', async (_, bvid, cid) => {
  //   try { return await getBilibiliSubtitle(bvid, cid) }
  //   catch { return null }
  // })
  // ipcMain.handle('lyric:align-first-line', async (_, lyrics, bvid, cid) => {
  //   try {
  //     const subs = await getBilibiliSubtitle(bvid, cid)
  //     if (!subs?.length) return { lyrics, offset: 0, matched: false }
  //     const result = alignFirstLine(lyrics, subs)
  //     return result ? { ...result, matched: true } : { lyrics, offset: 0, matched: false }
  //   } catch (e) { return { lyrics, offset: 0, matched: false, error: e.message } }
  // })
  // ipcMain.handle('lyric:auto-align', async (_, lyrics, bvid, cid) => {
  //   try {
  //     const subs = await getBilibiliSubtitle(bvid, cid)
  //     if (!subs?.length) return { lyrics, matched: 0 }
  //     return autoAlignAll(lyrics, subs)
  //   } catch (e) { return { lyrics, matched: 0, error: e.message } }
  // })
  ipcMain.handle('lyric:fetch', async (_, source, id) => {
    try {
      const result = await fetchLyric(source, id)
      if (result?.trans?.length) result.lyrics = mergeTranslations(result.lyrics, result.trans)
      return result
    } catch (e) { return { error: e.message } }
  })

  // ══════════════════════════════════════════
  //  本地歌词文件操作 — 列表、读取、保存、打开目录、清理
  // ══════════════════════════════════════════


  ipcMain.handle('lyric:list-local', async () => {
    try {
      const dir = getLyricsDir()
      return readdirSync(dir).filter(f => f.endsWith('.lrc')).map(file => {
        const fp = join(dir, file)
        const content = readFileSync(fp, 'utf-8')
        const lines = content.split('\n').filter(l => l.trim())
        const tiLine = lines.find(l => l.startsWith('[ti:'))
        const song = tiLine ? tiLine.replace('[ti:', '').replace(']', '').trim() : file.replace('.lrc', '')
        const arLine = lines.find(l => l.startsWith('[ar:'))
        const artist = arLine ? arLine.replace('[ar:', '').replace(']', '').trim() : ''
        const srcLine = lines.find(l => l.startsWith('[source:'))
        const sourceName = srcLine ? srcLine.replace('[source:', '').replace(']', '').trim() : ''
        return { fileName: file, filePath: fp, song, artist, lineCount: lines.filter(l => l.startsWith('[')).length, sourceName, source: 'local' }
      })
    } catch { return [] }
  })
  ipcMain.handle('lyric:read-local', async (_, fileName) => {
    try {
      const fp = join(getLyricsDir(), fileName)
      return existsSync(fp) ? readFileSync(fp, 'utf-8') : null
    } catch { return null }
  })
  ipcMain.handle('lyric:save-local', async (_, fileName, content) => {
    try {
      writeFileSync(join(getLyricsDir(), fileName), content, 'utf-8')
      if (isMainWindowAlive()) getMainWindow().webContents.send('lyrics-editor:saved')
      logger.info(`Local lyric saved: ${fileName}`)
      return { success: true }
    } catch (e) { return { error: e.message } }
  })
  ipcMain.handle('lyric:open-folder', async () => {
    try { await shell.openPath(getLyricsDir()); return { success: true } }
    catch (e) { return { error: e.message } }
  })
  ipcMain.handle('lyric:clear-local', async () => {
    try {
      const dir = getLyricsDir()
      const files = readdirSync(dir).filter(f => f.endsWith('.lrc'))
      for (const f of files) unlinkSync(join(dir, f))
      logger.info(`Cleared ${files.length} local lyrics`)
      return { success: true, cleared: files.length }
    } catch (e) { return { error: e.message } }
  })

  // ══════════════════════════════════════════
  //  歌词编辑器 — 打开/关闭编辑器窗口
  // ══════════════════════════════════════════
  // 打开时会等待窗口加载完成后发送曲目信息

  ipcMain.on('lyrics-editor:open', (_, trackInfo) => {
    wm.createLyricsEditorWindow()
    const ew = wm.getLyricsEditorWindow()
    if (ew && trackInfo) {
      ew.webContents.on('did-finish-load', () => ew.webContents.send('lyrics-editor:track', trackInfo), { once: true })
    }
  })
  ipcMain.on('lyrics-editor:close', () => {
    const ew = wm.getLyricsEditorWindow()
    if (ew && !ew.isDestroyed()) ew.close()
  })

  // ══════════════════════════════════════════
  //  桌面歌词 — 窗口管理、数据同步、控制转发
  //  数据流：player store → IPC → 桌面歌词窗口
  //  控制流：桌面歌词窗口 → IPC → 主窗口
  // ══════════════════════════════════════════

  ipcMain.on('desktop-lyrics:open', () => {
    wm.createDesktopLyricsWindow()
    const dl = getDesktopLyricsWindow()
    if (isDesktopLyricsAlive()) { dl.show(); dl.focus() }
    notifyMain('desktop-lyrics:visibility', true)
  })
  ipcMain.on('desktop-lyrics:close', () => {
    if (isDesktopLyricsAlive()) { wm.saveDesktopLyricsPosition(); getDesktopLyricsWindow().hide() }
    notifyMain('desktop-lyrics:visibility', false)
  })
  ipcMain.on('desktop-lyrics:toggle', () => {
    if (isDesktopLyricsAlive() && getDesktopLyricsWindow().isVisible()) {
      wm.saveDesktopLyricsPosition(); getDesktopLyricsWindow().hide()
      notifyMain('desktop-lyrics:visibility', false)
    } else {
      wm.createDesktopLyricsWindow()
      notifyMain('desktop-lyrics:visibility', true)
    }
  })
  ipcMain.on('desktop-lyrics:update-lyrics', (_, data) => {
    // 浅比较去重：歌词引用相同且时间未变则跳过
    if (currentLyricsData.lyrics === data.lyrics && currentLyricsData.currentTime === data.currentTime) return
    Object.assign(currentLyricsData, data)
    if (isDesktopLyricsAlive()) getDesktopLyricsWindow().webContents.send('desktop-lyrics:update', data)
  })
  ipcMain.on('desktop-lyrics:update-time', (_, time) => {
    // 时间未变则跳过
    if (currentLyricsData.currentTime === time) return
    currentLyricsData.currentTime = time
    if (isDesktopLyricsAlive()) getDesktopLyricsWindow().webContents.send('desktop-lyrics:time', time)
  })
  ipcMain.on('desktop-lyrics:update-track', (_, track) => {
    currentTrackInfo.value = track
    if (isDesktopLyricsAlive()) getDesktopLyricsWindow().webContents.send('desktop-lyrics:track', track)
  })
  ipcMain.on('desktop-lyrics:move-window', (event, dx, dy) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition()
      win.setPosition(x + dx, y + dy)
    }
  })
  ipcMain.on('desktop-lyrics:prev', () => notifyMain('player:prev'))
  ipcMain.on('desktop-lyrics:next', () => notifyMain('player:next'))
  ipcMain.on('desktop-lyrics:toggle-play', () => notifyMain('player:toggle-play'))
  ipcMain.on('desktop-lyrics:play-state', (_, playing) => {
    if (isDesktopLyricsAlive()) getDesktopLyricsWindow().webContents.send('desktop-lyrics:play-state', playing)
  })
  ipcMain.on('desktop-lyrics:set-ignore-events', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, { forward: true })
  })
  ipcMain.on('desktop-lyrics:set-always-on-top', (_, val) => {
    if (isDesktopLyricsAlive()) getDesktopLyricsWindow().setAlwaysOnTop(val)
  })
  ipcMain.on('desktop-lyrics:minimize', () => {
    if (isDesktopLyricsAlive()) getDesktopLyricsWindow().minimize()
  })
  ipcMain.on('desktop-lyrics:hide', () => {
    if (isDesktopLyricsAlive()) { wm.saveDesktopLyricsPosition(); getDesktopLyricsWindow().hide() }
    notifyMain('desktop-lyrics:visibility', false)
  })

  // ══════════════════════════════════════════
  //  窗口控制 — 最小化、最大化、关闭、隐藏到托盘
  // ══════════════════════════════════════════

  ipcMain.on('window:minimize', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.minimize()
  })
  ipcMain.on('window:maximize', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.handle('window:is-maximized', () => {
    const win = getMainWindow()
    return win && !win.isDestroyed() && win.isMaximized()
  })
  ipcMain.on('window:close-app', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.close()
  })
  ipcMain.on('window:minimize-to-tray', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.hide()
  })

  // ══════════════════════════════════════════
  //  缓存管理 — 查看统计、清空、调整上限
  // ══════════════════════════════════════════

  ipcMain.handle('cache:stats', () => getResponseCacheStats())
  ipcMain.handle('cache:clear', () => { clearResponseCache(); return { success: true } })
  ipcMain.handle('cache:set-max', (_, max) => { setResponseCacheMax(max); return { success: true } })

  logger.info('IPC handlers registered (' + Object.keys(ipcMain._events).length + ' channels)')
}
