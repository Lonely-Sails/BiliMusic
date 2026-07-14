import { app, BrowserWindow, ipcMain, protocol, net, screen, shell, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'

// API handlers
import { loadSession, apiGet, parseSetCookie, getSession } from './api/client'
import { getResponseCacheStats, clearResponseCache, setResponseCacheMax } from './api/cache'
import { searchVideo, getSearchSuggest, getHotSearch } from './api/search'
import { getVideoInfo, getAudioUrl } from './api/video'
import { getQrcode, pollLogin, completeLogin, checkLogin, logout, saveSession, clearAuth } from './api/auth'
import { listFavFolders, listFavResources, addFav, removeFav } from './api/fav'
import {
  getBilibiliSubtitle,
  searchCandidates,
  searchRankedCandidates,
  alignFirstLine,
  autoAlignAll,
  fetchLyric,
  parseLRC,
  mergeTranslations
} from './api/lyric'
import { getPopular } from './api/popular'
import { getMusicBanner, getHotToplist, getHotRank, getNewMusic, getComprehensiveRank } from './api/musicCenter'

let mainWindow = null
let tray = null
let desktopLyricsWindow = null
let lyricsEditorWindow = null
let SESSION_PATH = ''
let currentLyricsData = { lyrics: [], currentTime: 0 }
let currentTrackInfo = null

// ── Path Resolution ──
// In dev:  __dirname = electron/
// In prod: __dirname = dist-electron/
const PROJECT_ROOT = join(__dirname, '..')

function createWindow() {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 22 } }
      : { frame: false }
    ),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    show: false,
    backgroundColor: '#0a0a14'
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 最大化/还原通知
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximize-change', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximize-change', false)
  })

  // 点击关闭按钮时隐藏到托盘（不退出）
  mainWindow.on('close', (event) => {
    if (tray) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // Add Referer header for Bilibili CDN resources (images/avatars) to avoid 403
  // Use broad patterns to cover all current and future Bilibili image CDN subdomains
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.hdslb.com/*', '*://*.hdslb.net/*'] },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          'Referer': 'https://www.bilibili.com',
          'Origin': 'https://www.bilibili.com'
        }
      })
    }
  )

  // Open DevTools in development
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools()
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// ── Tray Icon ──
function createTray() {
  if (tray) return

  const iconPath = join(__dirname, '../icons/tray_icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  // macOS 标记为模板图像，自动适配亮暗模式
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)

  tray.setToolTip('BiliMusic')

  // 左键点击：显示/聚焦主窗口
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // 右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: '桌面歌词',
      click: () => {
        if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed() && desktopLyricsWindow.isVisible()) {
          saveDesktopLyricsPosition()
          desktopLyricsWindow.hide()
        } else {
          createDesktopLyricsWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu)
  })
}

// ── Desktop Lyrics Window ──
function createDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.show()
    desktopLyricsWindow.focus()
    return
  }

  // 读取保存的位置和大小
  let savedSize = null
  try {
    const pos = readDesktopLyricsPosition()
    if (pos) {
      savedSize = pos
    } else {
      const { width, height } = screen.getPrimaryDisplay().workAreaSize
      savedSize = { x: width - 520, y: height - 180, width: 500, height: 140 }
    }
  } catch (e) {}

  desktopLyricsWindow = new BrowserWindow({
    width: savedSize.width,
    height: savedSize.height,
    minWidth: 300,
    minHeight: 80,
    maxHeight: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    type: 'panel',
    title: '桌面歌词',
    webPreferences: {
      preload: process.env.VITE_DEV_SERVER_URL
        ? join(PROJECT_ROOT, 'electron/preload/desktopLyrics.js')
        : join(__dirname, 'preload/desktopLyrics.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    show: false,
    backgroundColor: '#00000000'
  })

  desktopLyricsWindow.setVisibleOnAllWorkspaces(true)

  // Load desktop lyrics – use Vite dev server in dev, built files in production
  if (process.env.VITE_DEV_SERVER_URL) {
    desktopLyricsWindow.loadURL(process.env.VITE_DEV_SERVER_URL + 'pages/desktop-lyrics/index.html')
  } else {
    desktopLyricsWindow.loadFile(join(__dirname, '../dist/pages/desktop-lyrics/index.html'))
  }

  desktopLyricsWindow.once('ready-to-show', () => {
    desktopLyricsWindow.show()
    syncDesktopLyricsData()
    // 通知主窗口桌面歌词已显示
    notifyMainDesktopLyricsVisibility(true)
  })

  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null
    // 通知主窗口桌面歌词已关闭
    notifyMainDesktopLyricsVisibility(false)
  })

  // 恢复保存的位置
  if (savedSize?.x != null) {
    desktopLyricsWindow.setPosition(savedSize.x, savedSize.y)
  }

  // 自动保存位置和大小
  desktopLyricsWindow.on('resize', () => saveDesktopLyricsPosition())
  desktopLyricsWindow.on('moved', () => saveDesktopLyricsPosition())
  desktopLyricsWindow.on('moved', () => saveDesktopLyricsPosition())
}

function destroyDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    saveDesktopLyricsPosition()
    desktopLyricsWindow.close()
    desktopLyricsWindow = null
  }
}

function saveDesktopLyricsPosition() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return
  try {
    const [x, y] = desktopLyricsWindow.getPosition()
    const [width, height] = desktopLyricsWindow.getSize()
    const visible = desktopLyricsWindow.isVisible()
    const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json')
    writeFileSync(posPath, JSON.stringify({ x, y, width, height, visible }))
  } catch (e) {}
}

function readDesktopLyricsPosition() {
  try {
    const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json')
    if (existsSync(posPath)) {
      return JSON.parse(readFileSync(posPath, 'utf-8'))
    }
  } catch (e) {}
  return null
}

function syncDesktopLyricsData() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return
  if (currentTrackInfo) {
    desktopLyricsWindow.webContents.send('desktop-lyrics:track', currentTrackInfo)
  }
  if (currentLyricsData.lyrics.length > 0) {
    desktopLyricsWindow.webContents.send('desktop-lyrics:update', currentLyricsData)
  }
}

// ── Lyrics Editor Window ──
function createLyricsEditorWindow() {
  if (lyricsEditorWindow && !lyricsEditorWindow.isDestroyed()) {
    lyricsEditorWindow.show()
    lyricsEditorWindow.focus()
    return
  }

  lyricsEditorWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    title: '歌词编辑',
    webPreferences: {
      preload: process.env.VITE_DEV_SERVER_URL
        ? join(PROJECT_ROOT, 'electron/preload/lyricsEditor.js')
        : join(__dirname, 'preload/lyricsEditor.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    show: false,
    backgroundColor: '#0f0f1a'
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    lyricsEditorWindow.loadURL(process.env.VITE_DEV_SERVER_URL + 'pages/lyrics-editor/index.html')
  } else {
    lyricsEditorWindow.loadFile(join(__dirname, '../dist/pages/lyrics-editor/index.html'))
  }

  lyricsEditorWindow.once('ready-to-show', () => {
    lyricsEditorWindow.show()
  })

  lyricsEditorWindow.on('closed', () => {
    lyricsEditorWindow = null
  })
}

// Load session on startup
function initSession() {
  try {
    if (existsSync(SESSION_PATH)) {
      const data = readFileSync(SESSION_PATH, 'utf-8')
      const session = JSON.parse(data)
      loadSession(session)
    }
  } catch (e) {
    console.error('Failed to load session:', e)
  }
}

// IPC Handlers
function notifyMainDesktopLyricsVisibility(visible) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop-lyrics:visibility', visible)
  }
}

async function ensureBiliSession() {
  // Step 1: 获取设备指纹 buvid3/buvid4（最低可用配置）
  try {
    const fp = await apiGet('https://api.bilibili.com/x/frontend/finger/spi')
    if (fp.code === 0 && fp.data) {
      const cookies = getSession().cookies
      if (fp.data.b_3 && !cookies.find((c) => c.name === 'buvid3')) {
        parseSetCookie([`buvid3=${fp.data.b_3}; path=/; domain=.bilibili.com`])
      }
      if (fp.data.b_4 && !cookies.find((c) => c.name === 'buvid4')) {
        parseSetCookie([`buvid4=${fp.data.b_4}; path=/; domain=.bilibili.com`])
      }
    }
  } catch (e) {
    console.warn('Failed to fetch fingerprint:', e)
  }

  // Step 2: 访问 nav 接口，触发 WBI 密钥缓存和完整的 Cookie 设置
  try {
    const navResp = await apiGet('https://api.bilibili.com/x/web-interface/nav')
    if (navResp.code === 0 && navResp.data) {
      return {
        loggedIn: !!navResp.data.isLogin,
        uid: navResp.data.mid || '',
        nickname: navResp.data.uname || '',
        avatar: navResp.data.face || ''
      }
    }
  } catch (e) {
    console.warn('Nav check failed:', e)
  }
  return { loggedIn: false, uid: '', nickname: '', avatar: '' }
}

function setupIPC() {
  ipcMain.handle('session:ensure', async () => {
    try {
      return await ensureBiliSession()
    } catch (e) {
      return { loggedIn: false, error: e.message }
    }
  })

  ipcMain.handle('search:video', async (event, keyword, page) => {
    try {
      return await searchVideo(keyword, page || 1)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('search:suggest', async (event, term) => {
    try {
      return await getSearchSuggest(term)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('search:hot', async () => {
    try {
      return await getHotSearch()
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('popular:get', async (event, pn) => {
    try {
      return await getPopular(pn || 1)
    } catch (e) {
      return { error: e.message }
    }
  })

  // ── Music Center APIs ──
  ipcMain.handle('music:banner', async () => {
    try {
      return await getMusicBanner()
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('music:hot-toplist', async () => {
    try {
      return await getHotToplist()
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('music:hot-rank', async () => {
    try {
      return await getHotRank()
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('music:new-music', async () => {
    try {
      return await getNewMusic()
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('music:comprehensive-rank', async (event, pn, ps) => {
    try {
      return await getComprehensiveRank(pn || 1, ps || 20)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('player:get-video-info', async (event, bvid, aid) => {
    try {
      return await getVideoInfo(bvid, aid)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('player:get-audio-url', async (event, bvid, cid) => {
    try {
      return await getAudioUrl(bvid, cid)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('auth:get-qrcode', async () => {
    try {
      return await getQrcode()
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('auth:clear', async () => {
    try {
      clearAuth()
      return { success: true }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('auth:poll-login', async (event, qrcodeKey) => {
    try {
      const result = await pollLogin(qrcodeKey)
      if (result.status === 'success') {
        // Visit SSO URL to get actual session cookies (SESSDATA, bili_jct, etc.)
        await completeLogin(result.url)
        saveSession(SESSION_PATH)
      }
      return result
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('auth:check-login', async () => {
    try {
      return await checkLogin()
    } catch (e) {
      return { loggedIn: false }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      return await logout()
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('fav:list-folders', async (event, upMid) => {
    try {
      return await listFavFolders(upMid)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('fav:list-resources', async (event, mediaId, page, upMid) => {
    try {
      return await listFavResources(mediaId, page || 1, 20, upMid)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('fav:add', async (event, bvid, mediaId) => {
    try {
      return await addFav(bvid, mediaId)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('fav:remove', async (event, bvid, mediaId) => {
    try {
      return await removeFav(bvid, mediaId)
    } catch (e) {
      return { error: e.message }
    }
  })

  // ── 本地歌词存储（纯文件操作，归属 IPC 层） ──
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

        // 优先匹配 bvid
        if (bvid) {
          const bvidLine = lines.find(l => l.startsWith('[bvid:'))
          const fileBvid = bvidLine ? bvidLine.replace('[bvid:', '').replace(']', '').trim() : ''
          if (fileBvid && fileBvid === bvid) {
            const lyrics = parseLRC(content)
            if (lyrics.length > 0) return lyrics
          }
        }

        // 匹配歌曲名
        if (title) {
          const tiLine = lines.find(l => l.startsWith('[ti:'))
          const songTitle = tiLine ? tiLine.replace('[ti:', '').replace(']', '').trim() : file.replace('.lrc', '')
          if (songTitle.toLowerCase().includes(keyword) || keyword.includes(songTitle.toLowerCase())) {
            const lyrics = parseLRC(content)
            if (lyrics.length > 0) return lyrics
          }
        }
      } catch {}
    }
    return null
  }

  /**
   * 从视频信息中提取最佳搜索关键词
   * 优先使用 bgm_info.music_title（去掉 "发现《》" 等前缀）
   */
  function extractSearchKeyword(videoInfo, fallbackTitle) {
    if (videoInfo?.bgm_info?.music_title) {
      const bgmTitle = videoInfo.bgm_info.music_title
        .replace(/^发现/, '')
        .replace(/[《》【】「」]/g, '')
        .trim()
      if (bgmTitle) return bgmTitle
    }
    if (videoInfo?.title) {
      // 从视频标题中提取括号内的歌名
      const patterns = [/《(.+?)》/, /【(.+?)】/, /「(.+?)」/, /"(.+?)"/]
      for (const p of patterns) {
        const m = videoInfo.title.match(p)
        if (m) return m[1].trim()
      }
      return videoInfo.title.trim()
    }
    return fallbackTitle?.trim() || ''
  }

  // ── 歌词：获取（后端编排：本地→字幕→在线排序搜索） ──
  ipcMain.handle('lyric:get', async (event, bvid, cid, title) => {
    try {
      // 1. 获取视频完整信息（含 bgm_info）
      let videoInfo = null
      if (bvid) {
        try {
          videoInfo = await getVideoInfo(bvid, null)
        } catch {}
      }

      // 2. 提取最佳搜索关键词
      const keyword = extractSearchKeyword(videoInfo, title)

      // 3. 优先匹配本地 LRC 文件
      if (keyword || bvid) {
        const localLyrics = findLocalLyric(keyword, bvid)
        if (localLyrics) return { source: 'local', lyrics: localLyrics }
      }

      // 4. 尝试 B 站 AI 字幕
      if (bvid && cid) {
        const subtitleLyrics = await getBilibiliSubtitle(bvid, cid)
        if (subtitleLyrics?.length > 0) {
          return { source: 'subtitle', lyrics: subtitleLyrics, hasSubtitle: true }
        }
      }

      // 5. 在线搜索（按相似度排序，取最高分）
      if (keyword) {
        const ranked = await searchRankedCandidates(keyword, videoInfo?.title || keyword, videoInfo?.author)
        const successful = []
        for (const c of ranked) {
          const result = await fetchLyric(c.source, c.id)
          if (result) {
            if (result.trans?.length) {
              result.lyrics = mergeTranslations(result.lyrics, result.trans)
            }
            successful.push({ ...result, candidate: c })
          }
        }
        // 在所有成功获取的候选中选相似度最高的
        if (successful.length > 0) {
          successful.sort((a, b) => (b.candidate?.score || 0) - (a.candidate?.score || 0))
          return successful[0]
        }
      }

      return { source: 'none', lyrics: [] }
    } catch (e) {
      return { error: e.message }
    }
  })

  // ── 歌词：简单搜索候选（向后兼容） ──
  ipcMain.handle('lyric:search-candidates', async (event, title) => {
    try {
      return await searchCandidates(title)
    } catch (e) {
      return { error: e.message }
    }
  })

  // ── 歌词：在线搜索候选（带回相似度排序） ──
  ipcMain.handle('lyric:search-ranked', async (event, keyword, videoTitle, author) => {
    try {
      return await searchRankedCandidates(keyword, videoTitle, author)
    } catch (e) {
      return { error: e.message }
    }
  })

  // ── 歌词：获取 B 站字幕 ──
  ipcMain.handle('lyric:get-subtitle', async (event, bvid, cid) => {
    try {
      return await getBilibiliSubtitle(bvid, cid)
    } catch (e) {
      return null
    }
  })

  // ── 歌词：默认校对（仅第一句） ──
  ipcMain.handle('lyric:align-first-line', async (event, lyrics, bvid, cid) => {
    try {
      const subtitles = await getBilibiliSubtitle(bvid, cid)
      if (!subtitles?.length) return { lyrics, offset: 0, matched: false }
      const result = alignFirstLine(lyrics, subtitles)
      return result ? { ...result, matched: true } : { lyrics, offset: 0, matched: false }
    } catch (e) {
      return { lyrics, offset: 0, matched: false, error: e.message }
    }
  })

  // ── 歌词：全自动校对（所有行） ──
  ipcMain.handle('lyric:auto-align', async (event, lyrics, bvid, cid) => {
    try {
      const subtitles = await getBilibiliSubtitle(bvid, cid)
      if (!subtitles?.length) return { lyrics, matched: 0 }
      return autoAlignAll(lyrics, subtitles)
    } catch (e) {
      return { lyrics, matched: 0, error: e.message }
    }
  })

  ipcMain.handle('lyric:fetch', async (event, source, id) => {
    try {
      const result = await fetchLyric(source, id)
      if (result?.trans?.length) {
        result.lyrics = mergeTranslations(result.lyrics, result.trans)
      }
      return result
    } catch (e) {
      return { error: e.message }
    }
  })

  // ── Lyrics Editor IPC ──
  function getLyricsDir() {
    const dir = join(app.getPath('userData'), 'lyrics')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  ipcMain.handle('lyric:list-local', async () => {
    try {
      const dir = getLyricsDir()
      const files = readdirSync(dir).filter(f => f.endsWith('.lrc'))
      const results = []
      for (const file of files) {
        const filePath = join(dir, file)
        const content = readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').filter(l => l.trim())
        // Extract song name from first metadata line or filename
        const titleLine = lines.find(l => l.startsWith('[ti:'))
        const song = titleLine ? titleLine.replace('[ti:', '').replace(']', '').trim() : file.replace('.lrc', '')
        const artistLine = lines.find(l => l.startsWith('[ar:'))
        const artist = artistLine ? artistLine.replace('[ar:', '').replace(']', '').trim() : ''
        const sourceLine = lines.find(l => l.startsWith('[source:'))
        const sourceName = sourceLine ? sourceLine.replace('[source:', '').replace(']', '').trim() : ''
        results.push({
          fileName: file,
          filePath,
          song,
          artist,
          lineCount: lines.filter(l => l.startsWith('[')).length,
          sourceName,
          source: 'local'
        })
      }
      return results
    } catch (e) {
      return []
    }
  })

  ipcMain.handle('lyric:read-local', async (event, fileName) => {
    try {
      const dir = getLyricsDir()
      const filePath = join(dir, fileName)
      if (!existsSync(filePath)) return null
      const content = readFileSync(filePath, 'utf-8')
      return content
    } catch (e) {
      return null
    }
  })

  ipcMain.handle('lyric:save-local', async (event, fileName, content) => {
    try {
      const dir = getLyricsDir()
      const filePath = join(dir, fileName)
      writeFileSync(filePath, content, 'utf-8')
      // 通知主窗口清除歌词缓存
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lyrics-editor:saved')
      }
      return { success: true }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('lyric:open-folder', async () => {
    try {
      const dir = getLyricsDir()
      await shell.openPath(dir)
      return { success: true }
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('lyric:clear-local', async () => {
    try {
      const dir = getLyricsDir()
      const files = readdirSync(dir).filter(f => f.endsWith('.lrc'))
      for (const file of files) {
        unlinkSync(join(dir, file))
      }
      return { success: true, cleared: files.length }
    } catch (e) {
      return { error: e.message }
    }
  })

  // ── Lyrics Editor IPC ──
  ipcMain.on('lyrics-editor:open', (_event, trackInfo) => {
    createLyricsEditorWindow()
    if (lyricsEditorWindow && trackInfo) {
      lyricsEditorWindow.webContents.on('did-finish-load', () => {
        lyricsEditorWindow.webContents.send('lyrics-editor:track', trackInfo)
      }, { once: true })
    }
  })

  ipcMain.on('lyrics-editor:close', () => {
    if (lyricsEditorWindow && !lyricsEditorWindow.isDestroyed()) {
      lyricsEditorWindow.close()
      lyricsEditorWindow = null
    }
  })

  // ── Desktop Lyrics IPC ──
  ipcMain.on('desktop-lyrics:open', () => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.show()
      desktopLyricsWindow.focus()
      syncDesktopLyricsData()
    } else {
      createDesktopLyricsWindow()
    }
    notifyMainDesktopLyricsVisibility(true)
  })

  ipcMain.on('desktop-lyrics:close', () => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      saveDesktopLyricsPosition()
      desktopLyricsWindow.hide()
    }
    notifyMainDesktopLyricsVisibility(false)
  })

  ipcMain.on('desktop-lyrics:toggle', () => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      if (desktopLyricsWindow.isVisible()) {
        saveDesktopLyricsPosition()
        desktopLyricsWindow.hide()
        notifyMainDesktopLyricsVisibility(false)
      } else {
        desktopLyricsWindow.show()
        desktopLyricsWindow.focus()
        syncDesktopLyricsData()
        notifyMainDesktopLyricsVisibility(true)
      }
    } else {
      createDesktopLyricsWindow()
      notifyMainDesktopLyricsVisibility(true)
    }
  })

  ipcMain.on('desktop-lyrics:update-lyrics', (event, data) => {
    currentLyricsData = data
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.webContents.send('desktop-lyrics:update', data)
    }
  })

  ipcMain.on('desktop-lyrics:update-time', (event, time) => {
    currentLyricsData.currentTime = time
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.webContents.send('desktop-lyrics:time', time)
    }
  })

  ipcMain.on('desktop-lyrics:update-track', (event, track) => {
    currentTrackInfo = track
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.webContents.send('desktop-lyrics:track', track)
    }
  })

  ipcMain.on('desktop-lyrics:move-window', (event, deltaX, deltaY) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition()
      win.setPosition(x + deltaX, y + deltaY)
    }
  })

  ipcMain.on('desktop-lyrics:prev', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('player:prev')
    }
  })

  ipcMain.on('desktop-lyrics:next', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('player:next')
    }
  })

  ipcMain.on('desktop-lyrics:toggle-play', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('player:toggle-play')
    }
  })

  ipcMain.on('desktop-lyrics:play-state', (event, playing) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.webContents.send('desktop-lyrics:play-state', playing)
    }
  })

  ipcMain.on('desktop-lyrics:set-ignore-events', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })

  ipcMain.on('desktop-lyrics:set-always-on-top', (event, val) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.setAlwaysOnTop(val)
    }
  })

  ipcMain.on('desktop-lyrics:minimize', () => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.minimize()
    }
  })

  // ── Window Controls ──
  ipcMain.on('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  })

  ipcMain.on('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()
  })

  ipcMain.on('window:close-app', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close()
    }
  })

  // ── Tray IPC ──
  ipcMain.on('window:minimize-to-tray', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide()
    }
  })

  // Handle window hide from desktop lyrics (隐藏而非销毁)
  ipcMain.on('desktop-lyrics:hide', () => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      saveDesktopLyricsPosition()
      desktopLyricsWindow.hide()
      // 通知主窗口桌面歌词已隐藏
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop-lyrics:visibility', false)
      }
    }
  })

  // ── Response Cache IPC ──
  ipcMain.handle('cache:stats', async () => {
    return getResponseCacheStats()
  })

  ipcMain.handle('cache:clear', async () => {
    clearResponseCache()
    return { success: true }
  })

  ipcMain.handle('cache:set-max', async (event, max) => {
    setResponseCacheMax(max)
    return { success: true }
  })
}

app.whenReady().then(() => {
  SESSION_PATH = join(app.getPath('userData'), 'session.json')

  // Register custom protocol for audio streaming (must be after app is ready)
  protocol.handle('bili', (request) => {
    const url = request.url.slice('bili://'.length)
    const decodedUrl = decodeURIComponent(url)
    return net.fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com'
      }
    })
  })

  initSession()
  setupIPC()
  createWindow()
  createTray()

  // 如果上次桌面歌词是打开的，自动重新打开
  try {
    const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json')
    if (existsSync(posPath)) {
      const state = JSON.parse(readFileSync(posPath, 'utf-8'))
      if (state.visible) {
        createDesktopLyricsWindow()
      }
    }
  } catch (e) {}

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // 有托盘图标时不退出，仅隐藏窗口
  if (!tray) {
    if (process.platform !== 'darwin') app.quit()
  }
})

// 点击关闭按钮时隐藏而非退出
app.on('before-quit', () => {
  if (tray) {
    tray.destroy()
    tray = null
  }
})
