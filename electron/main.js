/**
 * BiliMusic — Electron 主进程入口
 *
 * 职责：
 * 1. 注册自定义协议 `bili://` 用于音频流代理（绕过 CORS）
 * 2. 从磁盘加载持久化 Session（B站登录态）
 * 3. 创建窗口管理器、IPC 处理器、托盘
 * 4. 统一管理应用生命周期（窗口关闭 → 隐藏到托盘）
 */

import { app, protocol, net } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { logger } from './utils/logger.js'
import { createWindowManager } from './windows.js'
import { createTrayManager } from './tray.js'
import { setupIPC } from './ipc.js'
import { loadSession } from './api/client.js'

// ══════════════════════════════════════════
//  注册 bili:// 为特权协议（必须在 app.whenReady 之前）
// ══════════════════════════════════════════
// 用途：允许前端通过 createMediaElementSource / captureStream 处理音频
// 需要：standard + corsEnabled 让 Chromium 把 bili:// 视为支持 CORS 的标准协议
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'bili',
    privileges: {
      standard: true,
      secure: true,
      corsEnabled: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
])

// ── 全局共享状态 ──
// SESSION_PATH: 由 app.whenReady 设置，供 IPC 模块持久化 session
global.__SESSION_PATH = ''
// currentLyricsData/currentTrackInfo: 桌面歌词窗口的实时数据，通过引用共享给 IPC
const currentLyricsData = { lyrics: [], currentTime: 0 }
const currentTrackInfo = { value: null }

app.whenReady().then(() => {
  global.__SESSION_PATH = join(app.getPath('userData'), 'session.json')

  /**
   * 注册自定义协议 bili://
   * Bilibili 的音频 CDN 有严格的 Referer/Origin 校验，
   * 直接在前端 fetch 会触发 CORS 错误。
   * 通过 Electron 的 protocol.handle 代理请求，
   * 在服务端附加 B站要求的请求头后转发。
   */
  protocol.handle('bili', async (request) => {
    // URL 格式: bili://audio/<encoded-url>（standard scheme 需要合法 host）
    const url = request.url.slice('bili://audio/'.length)
    const decodedUrl = decodeURIComponent(url)
    logger.debug('Audio proxy:', decodedUrl.slice(0, 80) + '...')
    const response = await net.fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com'
      }
    })
    // 添加 CORS 头，允许前端 createMediaElementSource/captureStream
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  })

  // ── 从磁盘加载持久化的 B站登录态 ──
  try {
    if (existsSync(global.__SESSION_PATH)) {
      const data = readFileSync(global.__SESSION_PATH, 'utf-8')
      loadSession(JSON.parse(data))
      logger.info('Session loaded from disk')
    }
  } catch (e) { logger.error('Failed to load session:', e) }

  // ── 初始化各核心模块 ──
  const wm = createWindowManager()        // 窗口管理器（主窗口/桌面歌词/歌词编辑）
  setupIPC(wm, currentLyricsData, currentTrackInfo)  // IPC 通信处理器
  wm.createMainWindow()                   // 创建主窗口

  // 创建系统托盘（允许关闭窗口时隐藏到托盘而非退出）
  const trayMgr = createTrayManager({
    getMainWindow: () => wm.getMainWindow(),
    toggleDesktopLyrics: () => {
      const dlWin = wm.getDesktopLyricsWindow()
      if (dlWin && !dlWin.isDestroyed() && dlWin.isVisible()) {
        wm.saveDesktopLyricsPosition()
        dlWin.hide()
        wm.notifyMain('desktop-lyrics:visibility', false)
      } else {
        wm.createDesktopLyricsWindow()
        wm.notifyMain('desktop-lyrics:visibility', true)
      }
    }
  })
  trayMgr.create()

  // 如果上次退出时桌面歌词是打开的，自动恢复
  wm.restoreDesktopLyricsPosition()

  // ── 生命周期管理 ──
  // macOS: 关闭所有窗口时不退出（符合 macOS 惯例）
  // 其他平台: 无托盘时退出
  app.on('window-all-closed', () => {
    if (!trayMgr.isActive() && process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => { trayMgr.destroy() })

  // macOS: 点击 Dock 图标重新显示窗口
  app.on('activate', () => {
    const win = wm.getMainWindow()
    if (win && !win.isDestroyed()) { win.show(); win.focus() }
    else wm.createMainWindow()
  })

  // 主窗口关闭按钮行为：有托盘时隐藏到托盘，不退出
  const mainWindow = wm.getMainWindow()
  if (mainWindow) {
    mainWindow.on('close', (event) => {
      if (trayMgr.isActive()) {
        event.preventDefault()
        mainWindow.hide()
      }
    })
  }

  logger.info('BiliMusic started')
})
