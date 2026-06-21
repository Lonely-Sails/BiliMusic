import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Search
  searchVideo: (keyword, page) => ipcRenderer.invoke('search:video', keyword, page),
  getSearchSuggest: (term) => ipcRenderer.invoke('search:suggest', term),
  getHotSearch: () => ipcRenderer.invoke('search:hot'),

  // Player
  getVideoInfo: (bvid) => ipcRenderer.invoke('player:get-video-info', bvid),
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
  fetchLyric: (source, id) => ipcRenderer.invoke('lyric:fetch', source, id),
  // Lyrics Editor
  openLyricsEditor: (trackInfo) => ipcRenderer.send('lyrics-editor:open', trackInfo),
  listLocalLyrics: () => ipcRenderer.invoke('lyric:list-local'),
  readLocalLyric: (fileName) => ipcRenderer.invoke('lyric:read-local', fileName),
  saveLocalLyric: (fileName, content) => ipcRenderer.invoke('lyric:save-local', fileName, content),

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
  }
})
