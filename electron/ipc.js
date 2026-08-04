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

import { ipcMain } from 'electron';
import { join } from 'path';
import { logger } from './utils/logger.js';
import { getResponseCacheStats, clearResponseCache, setResponseCacheMax } from './api/cache.js';
import { searchVideo, getSearchSuggest, getHotSearch } from './api/search.js';
import { getSeasonArchives, batchCheckVideoSeason } from './api/video.js';
import {
  getQrcode,
  pollLogin,
  completeLogin,
  checkLogin,
  logout,
  saveSession,
  clearAuth,
} from './api/auth.js';
import { listFavFolders, listFavResources, addFav, removeFav } from './api/favorites.js';
import { getPopular } from './api/popular.js';
import {
  getMusicBanner,
  getHotToplist,
  getHotRank,
  getNewMusic,
  getComprehensiveRank,
} from './api/music.js';
import { getUserInfo, getUserRelationStat, getUserArchives } from './api/user.js';
import { resolveVideoInfo, resolveAudioUrl, fetchAudioBuffer } from './services/player.js';
import { ensureBiliSession } from './services/session.js';
import { registerDesktopLyricsIPC } from './ipc/desktop-lyrics.js';
import {
  getLyrics,
  searchCandidates,
  searchRankedCandidates,
  fetchMergedLyric,
  listLocalLyrics,
  readLocalLyric,
  saveLocalLyric,
  openLyricsFolder,
  clearLocalLyrics,
} from './services/lyrics.js';

export function setupIPC(wm, currentLyricsData, currentTrackInfo) {
  const { getMainWindow, isMainWindowAlive } = wm;

  // ══════════════════════════════════════════
  //  内部工具函数
  // ══════════════════════════════════════════

  ipcMain.handle('session:ensure', async () => {
    try {
      return await ensureBiliSession();
    } catch (e) {
      return { loggedIn: false, error: e.message };
    }
  });

  // ══════════════════════════════════════════
  //  Session / 搜索 / 音乐中心 — 批量注册简单 handler
  //  这些 handler 只是调用 API 函数并包装错误，结构完全一致
  // ══════════════════════════════════════════

  const simpleHandlers = {
    'search:video': (_, keyword, page, musicOnly) =>
      searchVideo(keyword, page || 1, 20, musicOnly !== false),
    'search:suggest': (_, term) => getSearchSuggest(term),
    'search:hot': () => getHotSearch(),
    'popular:get': (_, pn) => getPopular(pn || 1),
    'music:banner': () => getMusicBanner(),
    'music:hot-toplist': () => getHotToplist(),
    'music:hot-rank': () => getHotRank(),
    'music:new-music': () => getNewMusic(),
    'music:comprehensive-rank': (_, pn, ps) => getComprehensiveRank(pn || 1, ps || 20),
  };
  for (const [channel, handler] of Object.entries(simpleHandlers)) {
    ipcMain.handle(channel, async (...args) => {
      try {
        return await handler(...args);
      } catch (e) {
        return { error: e.message };
      }
    });
  }

  // ══════════════════════════════════════════
  //  播放器 — 获取视频信息和音频流 URL
  // ══════════════════════════════════════════

  ipcMain.handle('player:get-video-info', async (_, bvid, aid) => {
    try {
      return await resolveVideoInfo(bvid, aid);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('player:get-audio-url', async (_, bvid, cid) => {
    try {
      return await resolveAudioUrl(bvid, cid);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('player:get-audio-buffer', async (_, url) => {
    try {
      return await fetchAudioBuffer(url);
    } catch (e) {
      return { error: e.message };
    }
  });

  // ══════════════════════════════════════════
  //  合集 — 检测视频合集 / 获取合集内容
  // ══════════════════════════════════════════

  ipcMain.handle('season:check-batch', async (_, bvids) => {
    try {
      return await batchCheckVideoSeason(bvids || []);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('season:archives', async (_, mid, seasonId, pageNum, pageSize) => {
    try {
      return await getSeasonArchives(mid, seasonId, pageNum || 1, pageSize || 30);
    } catch (e) {
      return { error: e.message };
    }
  });

  // ══════════════════════════════════════════
  //  用户 — UP主信息 / 关系统计 / 投稿列表
  // ══════════════════════════════════════════

  ipcMain.handle('user:info', async (_, mid) => {
    try {
      return await getUserInfo(mid);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('user:relation-stat', async (_, mid) => {
    try {
      return await getUserRelationStat(mid);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('user:archives', async (_, mid, pageNum, pageSize, keyword) => {
    try {
      return await getUserArchives(mid, pageNum || 1, pageSize || 30, keyword || '');
    } catch (e) {
      return { error: e.message };
    }
  });

  // ══════════════════════════════════════════
  //  认证 — 二维码登录、登出、session 管理
  // ══════════════════════════════════════════

  ipcMain.handle('auth:get-qrcode', async () => {
    try {
      return await getQrcode();
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('auth:clear', async () => {
    try {
      clearAuth();
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('auth:poll-login', async (_, qrcodeKey) => {
    try {
      const result = await pollLogin(qrcodeKey);
      if (result.status === 'success') {
        await completeLogin(result.url);
        saveSession(global.__SESSION_PATH);
        logger.info('Login completed');
      }
      return result;
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('auth:check-login', async () => {
    try {
      return await checkLogin();
    } catch {
      return { loggedIn: false };
    }
  });
  ipcMain.handle('auth:logout', async () => {
    try {
      return await logout();
    } catch (e) {
      return { error: e.message };
    }
  });

  // ══════════════════════════════════════════
  //  收藏夹 — 列表、增删
  // ══════════════════════════════════════════

  ipcMain.handle('fav:list-folders', async (_, upMid) => {
    try {
      return await listFavFolders(upMid);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('fav:list-resources', async (_, mediaId, page, upMid) => {
    try {
      return await listFavResources(mediaId, page || 1, 20, upMid);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('fav:add', async (_, bvid, mediaId) => {
    try {
      return await addFav(bvid, mediaId);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('fav:remove', async (_, bvid, mediaId) => {
    try {
      return await removeFav(bvid, mediaId);
    } catch (e) {
      return { error: e.message };
    }
  });

  // ══════════════════════════════════════════
  //  歌词获取 — 编排式获取（本地LRC → 在线搜索）
  //  优先级：
  //    1. 本地已保存的 LRC 文件
  //    2. 第三方源（QQ/网易云），按相似度排序取最优
  //    （B站 AI 字幕已禁用）
  // ══════════════════════════════════════════

  ipcMain.handle('lyric:get', async (_, bvid, cid, title) => {
    try {
      return await getLyrics(bvid, cid, title);
    } catch (e) {
      logger.error('lyric:get failed:', e.message);
      return { error: e.message };
    }
  });

  ipcMain.handle('lyric:search-candidates', async (_, title) => {
    try {
      return await searchCandidates(title);
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('lyric:search-ranked', async (_, keyword, videoTitle, author) => {
    try {
      return await searchRankedCandidates(keyword, videoTitle, author);
    } catch (e) {
      return { error: e.message };
    }
  });
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
      return await fetchMergedLyric(source, id);
    } catch (e) {
      return { error: e.message };
    }
  });

  // ══════════════════════════════════════════
  //  本地歌词文件操作 — 列表、读取、保存、打开目录、清理
  // ══════════════════════════════════════════

  ipcMain.handle('lyric:list-local', async () => {
    return listLocalLyrics();
  });
  ipcMain.handle('lyric:read-local', async (_, fileName) => {
    try {
      return readLocalLyric(fileName);
    } catch {
      return null;
    }
  });
  ipcMain.handle('lyric:save-local', async (_, fileName, content) => {
    try {
      saveLocalLyric(fileName, content);
      if (isMainWindowAlive()) getMainWindow().webContents.send('lyrics-editor:saved');
      logger.info(`Local lyric saved: ${fileName}`);
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('lyric:open-folder', async () => {
    try {
      await openLyricsFolder();
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });
  ipcMain.handle('lyric:clear-local', async () => {
    try {
      const cleared = clearLocalLyrics();
      logger.info(`Cleared ${cleared} local lyrics`);
      return { success: true, cleared };
    } catch (e) {
      return { error: e.message };
    }
  });

  // ══════════════════════════════════════════
  //  歌词编辑器 — 打开/关闭编辑器窗口
  // ══════════════════════════════════════════
  // 打开时会等待窗口加载完成后发送曲目信息

  ipcMain.on('lyrics-editor:open', (_, trackInfo) => {
    wm.createLyricsEditorWindow();
    const ew = wm.getLyricsEditorWindow();
    if (ew && trackInfo) {
      ew.webContents.on(
        'did-finish-load',
        () => ew.webContents.send('lyrics-editor:track', trackInfo),
        { once: true }
      );
    }
  });
  ipcMain.on('lyrics-editor:close', () => {
    const ew = wm.getLyricsEditorWindow();
    if (ew && !ew.isDestroyed()) ew.close();
  });

  registerDesktopLyricsIPC(wm, currentLyricsData, currentTrackInfo);

  // ══════════════════════════════════════════
  //  窗口控制 — 最小化、最大化、关闭、隐藏到托盘
  // ══════════════════════════════════════════

  ipcMain.on('window:minimize', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.minimize();
  });
  ipcMain.on('window:maximize', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.handle('window:is-maximized', () => {
    const win = getMainWindow();
    return win && !win.isDestroyed() && win.isMaximized();
  });
  ipcMain.on('window:close-app', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.close();
  });
  ipcMain.on('window:minimize-to-tray', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.hide();
  });

  // ══════════════════════════════════════════
  //  缓存管理 — 查看统计、清空、调整上限
  // ══════════════════════════════════════════

  ipcMain.handle('cache:stats', () => getResponseCacheStats());
  ipcMain.handle('cache:clear', () => {
    clearResponseCache();
    return { success: true };
  });
  ipcMain.handle('cache:set-max', (_, max) => {
    setResponseCacheMax(max);
    return { success: true };
  });

  logger.info('IPC handlers registered (' + Object.keys(ipcMain._events).length + ' channels)');
}
