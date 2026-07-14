import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Search
  searchVideo: (keyword, page) => ipcRenderer.invoke('search:video', keyword, page),
  getSearchSuggest: (term) => ipcRenderer.invoke('search:suggest', term),
  getHotSearch: () => ipcRenderer.invoke('search:hot'),
  getPopular: (pn) => ipcRenderer.invoke('popular:get', pn),
  // Session
  ensureSession: () => ipcRenderer.invoke('session:ensure'),
  // Music Center
  getMusicBanner: () => ipcRenderer.invoke('music:banner'),
  getHotToplist: () => ipcRenderer.invoke('music:hot-toplist'),
  getHotRank: () => ipcRenderer.invoke('music:hot-rank'),
  getNewMusic: () => ipcRenderer.invoke('music:new-music'),
  getComprehensiveRank: (pn, ps) => ipcRenderer.invoke('music:comprehensive-rank', pn, ps),

  // Player
  getVideoInfo: (bvid, aid) => ipcRenderer.invoke('player:get-video-info', bvid, aid),
  getAudioUrl: (bvid, cid) => ipcRenderer.invoke('player:get-audio-url', bvid, cid),

  // Auth
  getQrcode: () => ipcRenderer.invoke('auth:get-qrcode'),
  pollLogin: (qrcodeKey) => ipcRenderer.invoke('auth:poll-login', qrcodeKey),
  checkLogin: () => ipcRenderer.invoke('auth:check-login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  clearAuth: () => ipcRenderer.invoke('auth:clear'),

  // Favorites
  listFavFolders: (upMid) => ipcRenderer.invoke('fav:list-folders', upMid),
  listFavResources: (mediaId, page, upMid) => ipcRenderer.invoke('fav:list-resources', mediaId, page, upMid),
  addFav: (bvid, mediaId) => ipcRenderer.invoke('fav:add', bvid, mediaId),
  removeFav: (bvid, mediaId) => ipcRenderer.invoke('fav:remove', bvid, mediaId),

  // Lyrics
  getLyric: (bvid, cid, title) => ipcRenderer.invoke('lyric:get', bvid, cid, title),
  searchLyricCandidates: (title) => ipcRenderer.invoke('lyric:search-candidates', title),
  searchRankedCandidates: (keyword, videoTitle, author) => ipcRenderer.invoke('lyric:search-ranked', keyword, videoTitle, author),
  fetchLyric: (source, id) => ipcRenderer.invoke('lyric:fetch', source, id),
  getSubtitle: (bvid, cid) => ipcRenderer.invoke('lyric:get-subtitle', bvid, cid),
  alignFirstLine: (lyrics, bvid, cid) => ipcRenderer.invoke('lyric:align-first-line', lyrics, bvid, cid),
  autoAlignAll: (lyrics, bvid, cid) => ipcRenderer.invoke('lyric:auto-align', lyrics, bvid, cid),
  // Lyrics Editor
  openLyricsEditor: (trackInfo) => ipcRenderer.send('lyrics-editor:open', trackInfo),
  listLocalLyrics: () => ipcRenderer.invoke('lyric:list-local'),
  readLocalLyric: (fileName) => ipcRenderer.invoke('lyric:read-local', fileName),
  saveLocalLyric: (fileName, content) => ipcRenderer.invoke('lyric:save-local', fileName, content),
  openLyricsFolder: () => ipcRenderer.invoke('lyric:open-folder'),
  clearLocalLyrics: () => ipcRenderer.invoke('lyric:clear-local'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close-app'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChange: (callback) => {
    ipcRenderer.on('window:maximize-change', (event, maximized) => callback(maximized))
  },
  getPlatform: () => process.platform,

  // Tray
  minimizeToTray: () => ipcRenderer.send('window:minimize-to-tray'),

  // Desktop Lyrics
  desktopLyricsToggle: () => ipcRenderer.send('desktop-lyrics:toggle'),
  desktopLyricsOpen: () => ipcRenderer.send('desktop-lyrics:open'),
  desktopLyricsClose: () => ipcRenderer.send('desktop-lyrics:close'),
  desktopLyricsUpdateLyrics: (data) => ipcRenderer.send('desktop-lyrics:update-lyrics', data),
  desktopLyricsUpdateTime: (time) => ipcRenderer.send('desktop-lyrics:update-time', time),
  desktopLyricsUpdateTrack: (track) => ipcRenderer.send('desktop-lyrics:update-track', track),
  desktopLyricsUpdatePlayState: (playing) => ipcRenderer.send('desktop-lyrics:play-state', playing),
  onDesktopLyricsVisibility: (callback) => {
    ipcRenderer.on('desktop-lyrics:visibility', (event, visible) => callback(visible))
  },
  onPlayerControl: (callback) => {
    ipcRenderer.on('player:prev', () => callback('prev'))
    ipcRenderer.on('player:next', () => callback('next'))
    ipcRenderer.on('player:toggle-play', () => callback('togglePlay'))
  },
  onLyricsEditorSaved: (callback) => {
    ipcRenderer.on('lyrics-editor:saved', () => callback())
  },

  // Cache
  getResponseCacheStats: () => ipcRenderer.invoke('cache:stats'),
  clearResponseCache: () => ipcRenderer.invoke('cache:clear'),
  setResponseCacheMax: (max) => ipcRenderer.invoke('cache:set-max', max),
})
