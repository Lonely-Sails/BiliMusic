/**
 * 桌面歌词 IPC — 窗口管理、数据同步与播放控制转发
 */

import { BrowserWindow, ipcMain } from 'electron';

export function registerDesktopLyricsIPC(windowManager, currentLyricsData, currentTrackInfo) {
  const { getDesktopLyricsWindow, isDesktopLyricsAlive, notifyMain } = windowManager;

  ipcMain.on('desktop-lyrics:open', () => {
    windowManager.createDesktopLyricsWindow();
    const window = getDesktopLyricsWindow();
    if (isDesktopLyricsAlive()) {
      window.show();
      window.focus();
    }
    notifyMain('desktop-lyrics:visibility', true);
  });

  ipcMain.on('desktop-lyrics:close', () => {
    if (isDesktopLyricsAlive()) {
      windowManager.saveDesktopLyricsPosition();
      getDesktopLyricsWindow().hide();
    }
    notifyMain('desktop-lyrics:visibility', false);
  });

  ipcMain.on('desktop-lyrics:toggle', () => {
    if (isDesktopLyricsAlive() && getDesktopLyricsWindow().isVisible()) {
      windowManager.saveDesktopLyricsPosition();
      getDesktopLyricsWindow().hide();
      notifyMain('desktop-lyrics:visibility', false);
      return;
    }
    windowManager.createDesktopLyricsWindow();
    notifyMain('desktop-lyrics:visibility', true);
  });

  ipcMain.on('desktop-lyrics:update-lyrics', (_, data) => {
    if (
      currentLyricsData.lyrics === data.lyrics &&
      currentLyricsData.currentTime === data.currentTime
    )
      return;
    Object.assign(currentLyricsData, data);
    if (isDesktopLyricsAlive())
      getDesktopLyricsWindow().webContents.send('desktop-lyrics:update', data);
  });

  ipcMain.on('desktop-lyrics:update-time', (_, time) => {
    if (currentLyricsData.currentTime === time) return;
    currentLyricsData.currentTime = time;
    if (isDesktopLyricsAlive())
      getDesktopLyricsWindow().webContents.send('desktop-lyrics:time', time);
  });

  ipcMain.on('desktop-lyrics:update-track', (_, track) => {
    currentTrackInfo.value = track;
    if (isDesktopLyricsAlive())
      getDesktopLyricsWindow().webContents.send('desktop-lyrics:track', track);
  });

  ipcMain.on('desktop-lyrics:move-window', (event, deltaX, deltaY) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return;
    const [x, y] = window.getPosition();
    window.setPosition(x + deltaX, y + deltaY);
  });

  ipcMain.on('desktop-lyrics:prev', () => notifyMain('player:prev'));
  ipcMain.on('desktop-lyrics:next', () => notifyMain('player:next'));
  ipcMain.on('desktop-lyrics:toggle-play', () => notifyMain('player:toggle-play'));
  ipcMain.on('desktop-lyrics:play-state', (_, playing) => {
    if (isDesktopLyricsAlive())
      getDesktopLyricsWindow().webContents.send('desktop-lyrics:play-state', playing);
  });
  ipcMain.on('desktop-lyrics:set-ignore-events', (event, ignore) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) window.setIgnoreMouseEvents(ignore, { forward: true });
  });
  ipcMain.on('desktop-lyrics:set-always-on-top', (_, value) => {
    if (isDesktopLyricsAlive()) getDesktopLyricsWindow().setAlwaysOnTop(value);
  });
  ipcMain.on('desktop-lyrics:minimize', () => {
    if (isDesktopLyricsAlive()) getDesktopLyricsWindow().minimize();
  });
  ipcMain.on('desktop-lyrics:hide', () => {
    if (isDesktopLyricsAlive()) {
      windowManager.saveDesktopLyricsPosition();
      getDesktopLyricsWindow().hide();
    }
    notifyMain('desktop-lyrics:visibility', false);
  });
}
