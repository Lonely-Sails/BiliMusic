import { app, BrowserWindow, ipcMain, protocol, net, screen, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'

// API handlers
import { loadSession } from './api/client'
import { searchVideo, getSearchSuggest, getHotSearch } from './api/search'
import { getVideoInfo, getAudioUrl } from './api/video'
import { getQrcode, pollLogin, completeLogin, checkLogin, logout, saveSession, clearAuth } from './api/auth'
import { listFavFolders, listFavResources, addFav, removeFav } from './api/fav'
import { getLyric, searchCandidates, fetchLyric } from './api/lyric'

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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    frame: true,
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

  // 点击关闭按钮时隐藏到托盘（不退出）
  mainWindow.on('close', (event) => {
    if (tray) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // Add Referer header for Bilibili CDN resources (images/avatars) to avoid 403
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['*://i0.hdslb.com/*', '*://i1.hdslb.com/*', '*://i2.hdslb.com/*'] },
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

  tray.setContextMenu(contextMenu)
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

function setupIPC() {
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

  ipcMain.handle('player:get-video-info', async (event, bvid) => {
    try {
      return await getVideoInfo(bvid)
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

  ipcMain.handle('lyric:get', async (event, bvid, cid, title) => {
    try {
      return await getLyric(bvid, cid, title)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('lyric:search-candidates', async (event, title) => {
    try {
      return await searchCandidates(title)
    } catch (e) {
      return { error: e.message }
    }
  })

  ipcMain.handle('lyric:fetch', async (event, source, id) => {
    try {
      return await fetchLyric(source, id)
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
