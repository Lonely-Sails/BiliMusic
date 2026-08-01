const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lyricsEditorAPI', {
  // Search
  searchLyricCandidates: (title) => ipcRenderer.invoke('lyric:search-candidates', title),
  searchRankedCandidates: (keyword, videoTitle, author) =>
    ipcRenderer.invoke('lyric:search-ranked', keyword, videoTitle, author),
  fetchLyric: (source, id) => ipcRenderer.invoke('lyric:fetch', source, id),

  // Local files
  listLocalLyrics: () => ipcRenderer.invoke('lyric:list-local'),
  readLocalLyric: (fileName) => ipcRenderer.invoke('lyric:read-local', fileName),
  saveLocalLyric: (fileName, content) => ipcRenderer.invoke('lyric:save-local', fileName, content),

  // Subtitle & Alignment（B站字幕已禁用）
  // getSubtitle: (bvid, cid) => ipcRenderer.invoke('lyric:get-subtitle', bvid, cid),
  // alignFirstLine: (lyrics, bvid, cid) => ipcRenderer.invoke('lyric:align-first-line', lyrics, bvid, cid),
  // autoAlignAll: (lyrics, bvid, cid) => ipcRenderer.invoke('lyric:auto-align', lyrics, bvid, cid),

  // Window
  closeWindow: () => ipcRenderer.send('lyrics-editor:close'),
  onTrackInfo: (callback) => {
    ipcRenderer.on('lyrics-editor:track', (_event, info) => callback(info));
  },
});
