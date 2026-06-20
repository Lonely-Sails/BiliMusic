const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopLyricsAPI', {
  onLyricsUpdate: (callback) => {
    ipcRenderer.on('desktop-lyrics:update', (event, data) => callback(data))
  },
  onTimeUpdate: (callback) => {
    ipcRenderer.on('desktop-lyrics:time', (event, time) => callback(time))
  },
  onTrackChange: (callback) => {
    ipcRenderer.on('desktop-lyrics:track', (event, track) => callback(track))
  },
  onVisibilityChange: (callback) => {
    ipcRenderer.on('desktop-lyrics:visibility', (event, visible) => callback(visible))
  },
  setIgnoreEvents: (ignore) => ipcRenderer.send('desktop-lyrics:set-ignore-events', ignore),
  setAlwaysOnTop: (val) => ipcRenderer.send('desktop-lyrics:set-always-on-top', val),
  hide: () => ipcRenderer.send('desktop-lyrics:hide'),
  minimize: () => ipcRenderer.send('desktop-lyrics:minimize'),
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('desktop-lyrics:move-window', deltaX, deltaY),
  prevTrack: () => ipcRenderer.send('desktop-lyrics:prev'),
  nextTrack: () => ipcRenderer.send('desktop-lyrics:next'),
  togglePlay: () => ipcRenderer.send('desktop-lyrics:toggle-play'),
  onPlayState: (callback) => {
    ipcRenderer.on('desktop-lyrics:play-state', (event, playing) => callback(playing))
  }
})
