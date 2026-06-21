const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lyricsEditorAPI', {
  // Search
  searchLyricCandidates: (title) => ipcRenderer.invoke('lyric:search-candidates', title),
  fetchLyric: (source, id) => ipcRenderer.invoke('lyric:fetch', source, id),

  // Local files
  listLocalLyrics: () => ipcRenderer.invoke('lyric:list-local'),
  readLocalLyric: (fileName) => ipcRenderer.invoke('lyric:read-local', fileName),
  saveLocalLyric: (fileName, content) => ipcRenderer.invoke('lyric:save-local', fileName, content),

  // Window
  closeWindow: () => ipcRenderer.send('lyrics-editor:close'),
  onTrackInfo: (callback) => {
    ipcRenderer.on('lyrics-editor:track', (_event, info) => callback(info))
  },
})
