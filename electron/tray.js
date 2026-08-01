/**
 * 系统托盘管理器
 *
 * 功能：
 * - macOS 模板图标（自动适配明暗模式）
 * - 左键点击：显示/聚焦主窗口
 * - 右键菜单：显示主窗口、切换桌面歌词、退出
 * - 主窗口关闭时隐藏到托盘（不退出应用）
 */

import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'path';
import { logger } from './utils/logger.js';

export function createTrayManager({ getMainWindow, toggleDesktopLyrics }) {
  let tray = null;

  /** 创建托盘图标和右键菜单 */
  function create() {
    if (tray) return;
    logger.info('Creating tray icon');

    const iconPath = join(__dirname, '../icons/tray_icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') icon.setTemplateImage(true);

    tray = new Tray(icon);
    tray.setToolTip('BiliMusic');

    // 左键：显示/聚焦主窗口
    tray.on('click', () => focusMainWindow());

    // 右键：弹出菜单
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => focusMainWindow(),
      },
      {
        label: '桌面歌词',
        click: () => toggleDesktopLyrics(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          if (tray) {
            tray.destroy();
            tray = null;
          }
          app.quit();
        },
      },
    ]);
    tray.on('right-click', () => tray.popUpContextMenu(contextMenu));
  }

  /** 辅助：聚焦主窗口 */
  function focusMainWindow() {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  }

  /** 销毁托盘 */
  function destroy() {
    if (tray) {
      tray.destroy();
      tray = null;
    }
  }

  /** 托盘是否激活 */
  function isActive() {
    return !!tray;
  }

  return { create, destroy, isActive };
}
