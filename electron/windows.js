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

import { BrowserWindow, screen, app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { logger } from './utils/logger.js'

// 项目根目录（dev: electron/../ → 项目根; prod: dist-electron/../ → 项目根）
const PROJECT_ROOT = join(__dirname, '..')

export function createWindowManager() {
  let mainWindow = null
  let desktopLyricsWindow = null
  let lyricsEditorWindow = null

  // ══════════════════════════════════════════
  //  主窗口 — 应用主界面
  // ══════════════════════════════════════════
  function createMainWindow() {
    const isMac = process.platform === 'darwin'
    logger.info('Creating main window')

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

    mainWindow.once('ready-to-show', () => mainWindow.show())

    mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximize-change', true))
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximize-change', false))

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

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.webContents.openDevTools()
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
      mainWindow.loadFile(join(PROJECT_ROOT, 'dist/index.html'))
    }
  }

  function getMainWindow() { return mainWindow }
  function isMainWindowAlive() { return mainWindow && !mainWindow.isDestroyed() }

  // ══════════════════════════════════════════
  //  桌面歌词窗口 — 透明悬浮窗，始终置顶
  //  通过 IPC 从主窗口实时同步歌词/时间/曲目
  // ══════════════════════════════════════════
  function createDesktopLyricsWindow() {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.show()
      desktopLyricsWindow.focus()
      return
    }

    logger.info('Creating desktop lyrics window')
    const savedPos = readDesktopLyricsPosition()
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
    const pos = savedPos || { x: sw - 520, y: sh - 180, width: 500, height: 140 }

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
          : join(__dirname, 'preload/desktopLyrics.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false
      },
      show: false,
      backgroundColor: '#00000000'
    })

    desktopLyricsWindow.setVisibleOnAllWorkspaces(true)

    if (process.env.VITE_DEV_SERVER_URL) {
      desktopLyricsWindow.loadURL(process.env.VITE_DEV_SERVER_URL + 'pages/desktop-lyrics/index.html')
    } else {
      desktopLyricsWindow.loadFile(join(PROJECT_ROOT, 'dist/pages/desktop-lyrics/index.html'))
    }

    desktopLyricsWindow.once('ready-to-show', () => desktopLyricsWindow.show())

    if (pos?.x != null) desktopLyricsWindow.setPosition(pos.x, pos.y)
    desktopLyricsWindow.on('resize', () => saveDesktopLyricsPosition())
    desktopLyricsWindow.on('moved', () => saveDesktopLyricsPosition())
    desktopLyricsWindow.on('closed', () => {
      desktopLyricsWindow = null
      notifyMain('desktop-lyrics:visibility', false)
    })
  }

  function restoreDesktopLyricsPosition() {
    try {
      const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json')
      if (existsSync(posPath)) {
        const state = JSON.parse(readFileSync(posPath, 'utf-8'))
        if (state.visible) {
          logger.info('Restoring desktop lyrics from saved state')
          createDesktopLyricsWindow()
        }
      }
    } catch { /* ignore */ }
  }

  function saveDesktopLyricsPosition() {
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return
    try {
      const [x, y] = desktopLyricsWindow.getPosition()
      const [width, height] = desktopLyricsWindow.getSize()
      const visible = desktopLyricsWindow.isVisible()
      const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json')
      writeFileSync(posPath, JSON.stringify({ x, y, width, height, visible }))
    } catch { /* ignore */ }
  }

  function readDesktopLyricsPosition() {
    try {
      const posPath = join(app.getPath('userData'), 'desktop-lyrics-pos.json')
      if (existsSync(posPath)) return JSON.parse(readFileSync(posPath, 'utf-8'))
    } catch { /* ignore */ }
    return null
  }

  function getDesktopLyricsWindow() { return desktopLyricsWindow }
  function isDesktopLyricsAlive() { return desktopLyricsWindow && !desktopLyricsWindow.isDestroyed() }

  // ── Lyrics Editor Window ──
  function createLyricsEditorWindow() {
    if (lyricsEditorWindow && !lyricsEditorWindow.isDestroyed()) {
      lyricsEditorWindow.show()
      lyricsEditorWindow.focus()
      return
    }

    logger.info('Creating lyrics editor window')
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
      lyricsEditorWindow.loadFile(join(PROJECT_ROOT, 'dist/pages/lyrics-editor/index.html'))
    }

    lyricsEditorWindow.once('ready-to-show', () => lyricsEditorWindow.show())
    lyricsEditorWindow.on('closed', () => { lyricsEditorWindow = null })
  }

  function getLyricsEditorWindow() { return lyricsEditorWindow }

  // ── Helpers ──
  function notifyMain(channel, data) {
    if (isMainWindowAlive()) mainWindow.webContents.send(channel, data)
  }

  return {
    createMainWindow, getMainWindow, isMainWindowAlive,
    createDesktopLyricsWindow, getDesktopLyricsWindow, isDesktopLyricsAlive,
    restoreDesktopLyricsPosition, saveDesktopLyricsPosition,
    createLyricsEditorWindow, getLyricsEditorWindow,
    notifyMain
  }
}
