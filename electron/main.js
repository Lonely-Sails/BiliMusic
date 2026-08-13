/**
 * BiliMusic — Electron 主进程入口
 *
 * 职责：
 * 1. 从磁盘加载持久化 Session（B站登录态）
 * 2. 创建窗口管理器、IPC 处理器、托盘
 * 3. 统一管理应用生命周期（窗口关闭 → 隐藏到托盘）
 *
 * 注：B站 CDN（图片/音频）请求头注入由 windows.js 的 webRequest 拦截完成，
 * 不再使用自定义协议代理音频流。
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { logger } from './utils/logger.js';
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

app.whenReady().then(() => {
  global.__SESSION_PATH = join(app.getPath('userData'), 'session.json');

  // ── 从磁盘加载持久化的 B站登录态 ──
  try {
    if (existsSync(global.__SESSION_PATH)) {
      const data = readFileSync(global.__SESSION_PATH, 'utf-8');
      loadSession(JSON.parse(data));
      logger.info('Session loaded from disk');
    }
  } catch (e) {
    logger.error('Failed to load session:', e);
  }

  // ── 初始化各核心模块 ──
  const wm = createWindowManager(); // 窗口管理器（主窗口/桌面歌词/歌词编辑）
  setupIPC(wm, currentLyricsData, currentTrackInfo); // IPC 通信处理器
  wm.createMainWindow(); // 创建主窗口

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
