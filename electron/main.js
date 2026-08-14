/**
 * BiliMusic — Electron 主进程入口
 *
 * 职责：
 * 1. 从磁盘加载持久化 Session（B站登录态，safeStorage 加密）
 * 2. 创建窗口管理器、IPC 处理器、托盘
 * 3. 统一管理应用生命周期（窗口关闭 → 隐藏到托盘）
 * 4. 单实例锁 + 全局媒体键（播放/暂停、上一曲、下一曲）
 *
 * 注：B站 CDN（图片/音频）请求头注入由 windows.js 的 webRequest 拦截完成，
 * 不再使用自定义协议代理音频流。
 */

import { app, globalShortcut } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from './utils/logger.js';
import { loadSessionFile, saveSessionFile } from './utils/session-store.js';
import { createWindowManager } from './windows.js';
import { createTrayManager } from './tray.js';
import { setupIPC } from './ipc.js';
import { loadSession } from './api/client.js';

// ── 全局共享状态 ──
// SESSION_PATH: 由 app.whenReady 设置，供 IPC 模块持久化 session
global.__SESSION_PATH = '';
// currentLyricsData/currentTrackInfo: 桌面歌词窗口的实时数据，通过引用共享给 IPC
const currentLyricsData = { lyrics: [], currentTime: 0 };
const currentTrackInfo = { value: null };
// 窗口管理器实例（whenReady 中创建，供 second-instance 聚焦已有窗口）
let windowManager = null;

// ── 全局媒体键 → 主窗口播放控制通道（preload onPlayerControl 已订阅） ──
const MEDIA_KEY_SHORTCUTS = [
  { accelerator: 'MediaPlayPause', channel: 'player:toggle-play' },
  { accelerator: 'MediaNextTrack', channel: 'player:next' },
  { accelerator: 'MediaPreviousTrack', channel: 'player:prev' },
];

// ── 单实例锁：防止同时开多个实例（第二个实例直接退出并聚焦已有窗口） ──
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = windowManager?.getMainWindow();
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    global.__SESSION_PATH = join(app.getPath('userData'), 'session.json');

    // ── 从磁盘加载持久化的 B站登录态（safeStorage 加密） ──
    try {
      if (existsSync(global.__SESSION_PATH)) {
        const session = loadSessionFile(global.__SESSION_PATH);
        if (session) {
          loadSession(session);
          // 重写一次：旧版本明文/未加密格式自动迁移为 safeStorage 加密格式
          saveSessionFile(global.__SESSION_PATH, session);
          logger.info('Session loaded from disk');
        }
      }
    } catch (e) {
      logger.error('Failed to load session:', e);
    }

    // ── 初始化各核心模块 ──
    windowManager = createWindowManager(); // 窗口管理器（主窗口/桌面歌词/歌词编辑）
    const wm = windowManager;
    setupIPC(wm, currentLyricsData, currentTrackInfo); // IPC 通信处理器
    wm.createMainWindow(); // 创建主窗口

    // ── 全局媒体键注册（窗口隐藏到托盘时依然生效） ──
    for (const { accelerator, channel } of MEDIA_KEY_SHORTCUTS) {
      const ok = globalShortcut.register(accelerator, () => {
        if (wm.isMainWindowAlive()) wm.notifyMain(channel);
      });
      if (!ok) logger.warn(`Failed to register media key: ${accelerator}`);
    }

    // 创建系统托盘（允许关闭窗口时隐藏到托盘而非退出）
    const trayMgr = createTrayManager({
      getMainWindow: () => wm.getMainWindow(),
      toggleDesktopLyrics: () => {
        const dlWin = wm.getDesktopLyricsWindow();
        if (dlWin && !dlWin.isDestroyed() && dlWin.isVisible()) {
          wm.saveDesktopLyricsPosition();
          dlWin.hide();
          wm.notifyMain('desktop-lyrics:visibility', false);
        } else {
          wm.createDesktopLyricsWindow();
          wm.notifyMain('desktop-lyrics:visibility', true);
        }
      },
    });
    trayMgr.create();

    // 如果上次退出时桌面歌词是打开的，自动恢复
    wm.restoreDesktopLyricsPosition();

    // ── 生命周期管理 ──
    // macOS: 关闭所有窗口时不退出（符合 macOS 惯例）
    // 其他平台: 无托盘时退出
    app.on('window-all-closed', () => {
      if (!trayMgr.isActive() && process.platform !== 'darwin') app.quit();
    });

    app.on('before-quit', () => {
      trayMgr.destroy();
    });

    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
    });

    // macOS: 点击 Dock 图标重新显示窗口
    app.on('activate', () => {
      const win = wm.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
      } else wm.createMainWindow();
    });

    // 主窗口关闭按钮行为：有托盘时隐藏到托盘，不退出
    const mainWindow = wm.getMainWindow();
    if (mainWindow) {
      mainWindow.on('close', (event) => {
        if (trayMgr.isActive()) {
          event.preventDefault();
          mainWindow.hide();
        }
      });
    }

    logger.info('BiliMusic started');
  });
}
