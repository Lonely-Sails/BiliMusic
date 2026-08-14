/**
 * 窗口管理器 — 统一管理 BiliMusic 的所有窗口
 *
 * 管理三种窗口：
 * 1. mainWindow — 主应用窗口（含隐藏式标题栏、CDN 请求头注入）
 * 2. desktopLyricsWindow — 桌面歌词悬浮窗（透明、置顶、独立进程）
 * 3. lyricsEditorWindow — 歌词编辑器（独立窗口）
 *
 * 桌面歌词支持位置/大小持久化，重启后自动恢复。
 */

import { BrowserWindow, screen, app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { logger } from './utils/logger.js';

// 项目根目录（dev: electron/../ → 项目根; prod: dist-electron/../ → 项目根）
const PROJECT_ROOT = join(__dirname, '..');

/**
 * B站 CDN 请求拦截 — 图片/音频资源直连所需的请求头注入
 *
 * 图片 CDN（hdslb/biliimg）与音频 CDN（bilivideo/akamaized）统一在这里处理：
 * - onBeforeSendHeaders：注入 Referer/Origin，绕过 B站 CDN 的防盗链校验
 * - onHeadersReceived：注入 Access-Control-Allow-Origin，
 *   使 <audio crossOrigin="anonymous"> 与 Web Audio（响度均衡）拿到 CORS-clean 资源
 *
 * 替代原 bili:// 自定义协议代理方案：音频流不再经主进程转发，
 * 由渲染进程网络栈直接加载 CDN 流，减少一次进程间传输。
 */
const CDN_URL_PATTERNS = [
  '*://*.hdslb.com/*',
  '*://*.hdslb.net/*',
  '*://*.biliimg.com/*',
  '*://*.bilivideo.com/*',
  '*://*.bilivideo.cn/*',
  '*://*.akamaized.net/*',
];

export function createWindowManager() {
  let mainWindow = null;
  let desktopLyricsWindow = null;
  let lyricsEditorWindow = null;

  // ══════════════════════════════════════════
  //  主窗口 — 应用主界面
  // ══════════════════════════════════════════
  function createMainWindow() {
    const isMac = process.platform === 'darwin';
    logger.info('Creating main window');

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      ...(isMac
        ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 22 } }
        : { frame: false }),
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
      show: false,
      backgroundColor: '#0a0a14',
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());

    mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximize-change', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximize-change', false));

    // 请求头注入：Referer/Origin（防盗链）+ CORS 响应头（Web Audio 需要 CORS-clean 音频）
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: CDN_URL_PATTERNS },
      (details, callback) => {
        callback({
          requestHeaders: {
            ...details.requestHeaders,
            Referer: 'https://www.bilibili.com',
            Origin: 'https://www.bilibili.com',
          },
        });
      }
    );
    mainWindow.webContents.session.webRequest.onHeadersReceived(
      { urls: CDN_URL_PATTERNS },
      (details, callback) => {
        // 音频流 403（登录过期/权限不足）→ 通知渲染进程触发一次登录态检测
        if (details.resourceType === 'media' && details.statusCode === 403) {
          mainWindow.webContents.send('player:audio-forbidden', {
            url: details.url,
            status: details.statusCode,
          });
        }
        // B站 CDN 会按请求的 Origin 回显自身的 ACAO（如 https://www.bilibili.com），
        // 与页面实际 origin（localhost/file://）不匹配；统一覆盖为 *。
        // 必须先移除原有值（HTTP 头名大小写不敏感），否则会出现多个 ACAO 头导致 CORS 失败。
        const responseHeaders = { ...details.responseHeaders };
        for (const key of Object.keys(responseHeaders)) {
          if (/^access-control-allow-origin$/i.test(key)) delete responseHeaders[key];
        }
        responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        callback({ responseHeaders });
      }
    );

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.webContents.openDevTools();
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(join(PROJECT_ROOT, 'dist/index.html'));
    }
  }

  function getMainWindow() {
    return mainWindow;
  }
  function isMainWindowAlive() {
    return mainWindow && !mainWindow.isDestroyed();
  }

  // ══════════════════════════════════════════
  //  桌面歌词窗口 — 透明悬浮窗，始终置顶
  //  通过 IPC 从主窗口实时同步歌词/时间/曲目
  // ══════════════════════════════════════════
  function createDesktopLyricsWindow() {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.show();
      desktopLyricsWindow.focus();
      return;
    }

    logger.info('Creating desktop lyrics window');
    const savedPos = readDesktopLyricsPosition();
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const pos = savedPos || { x: sw - 520, y: sh - 180, width: 500, height: 140 };

    desktopLyricsWindow = new BrowserWindow({
      width: pos.width,
      height: pos.height,
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
          : join(__dirname, 'desktopLyrics.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
      },
      show: false,
      backgroundColor: '#00000000',
    });

    desktopLyricsWindow.setVisibleOnAllWorkspaces(true);

    if (process.env.VITE_DEV_SERVER_URL) {
      desktopLyricsWindow.loadURL(
        process.env.VITE_DEV_SERVER_URL + 'pages/desktop-lyrics/index.html'
      );
    } else {
      desktopLyricsWindow.loadFile(join(PROJECT_ROOT, 'dist/pages/desktop-lyrics/index.html'));
    }

    desktopLyricsWindow.once('ready-to-show', () => desktopLyricsWindow.show());

    if (pos?.x != null) desktopLyricsWindow.setPosition(pos.x, pos.y);
    desktopLyricsWindow.on('resize', () => saveDesktopLyricsPosition());
    desktopLyricsWindow.on('moved', () => saveDesktopLyricsPosition());
    desktopLyricsWindow.on('closed', () => {
      desktopLyricsWindow = null;
      notifyMain('desktop-lyrics:visibility', false);
    });
  }

  function restoreDesktopLyricsPosition() {
    try {
      const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json');
      if (existsSync(posPath)) {
        const state = JSON.parse(readFileSync(posPath, 'utf-8'));
        if (state.visible) {
          logger.info('Restoring desktop lyrics from saved state');
          createDesktopLyricsWindow();
        }
      }
    } catch {
      /* ignore */
    }
  }

  function saveDesktopLyricsPosition() {
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
    try {
      const [x, y] = desktopLyricsWindow.getPosition();
      const [width, height] = desktopLyricsWindow.getSize();
      const visible = desktopLyricsWindow.isVisible();
      const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json');
      writeFileSync(posPath, JSON.stringify({ x, y, width, height, visible }));
    } catch {
      /* ignore */
    }
  }

  function readDesktopLyricsPosition() {
    try {
      const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json');
      if (existsSync(posPath)) return JSON.parse(readFileSync(posPath, 'utf-8'));
    } catch {
      /* ignore */
    }
    return null;
  }

  function getDesktopLyricsWindow() {
    return desktopLyricsWindow;
  }
  function isDesktopLyricsAlive() {
    return desktopLyricsWindow && !desktopLyricsWindow.isDestroyed();
  }

  // ── Lyrics Editor Window ──
  function createLyricsEditorWindow() {
    if (lyricsEditorWindow && !lyricsEditorWindow.isDestroyed()) {
      lyricsEditorWindow.show();
      lyricsEditorWindow.focus();
      return;
    }

    logger.info('Creating lyrics editor window');
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
          : join(__dirname, 'lyricsEditor.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
      },
      show: false,
      backgroundColor: '#0f0f1a',
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      lyricsEditorWindow.loadURL(
        process.env.VITE_DEV_SERVER_URL + 'pages/lyrics-editor/index.html'
      );
    } else {
      lyricsEditorWindow.loadFile(join(PROJECT_ROOT, 'dist/pages/lyrics-editor/index.html'));
    }

    lyricsEditorWindow.once('ready-to-show', () => lyricsEditorWindow.show());
    lyricsEditorWindow.on('closed', () => {
      lyricsEditorWindow = null;
    });
  }

  function getLyricsEditorWindow() {
    return lyricsEditorWindow;
  }

  // ── Helpers ──
  function notifyMain(channel, data) {
    if (isMainWindowAlive()) mainWindow.webContents.send(channel, data);
  }

  return {
    createMainWindow,
    getMainWindow,
    isMainWindowAlive,
    createDesktopLyricsWindow,
    getDesktopLyricsWindow,
    isDesktopLyricsAlive,
    restoreDesktopLyricsPosition,
    saveDesktopLyricsPosition,
    createLyricsEditorWindow,
    getLyricsEditorWindow,
    notifyMain,
  };
}
