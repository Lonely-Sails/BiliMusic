import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEYS = {
  playlist: 'bilimusic_playlist',
  volume: 'bilimusic_volume',
  playMode: 'bilimusic_playmode'
}

export const usePlayerStore = defineStore('player', () => {
  // --- State ---
  const playlist = ref(loadFromStorage(STORAGE_KEYS.playlist, []))
  const currentIndex = ref(-1)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(loadFromStorage(STORAGE_KEYS.volume, 0.7))
  const playMode = ref(loadFromStorage(STORAGE_KEYS.playMode, 0))
  const currentLyrics = ref([])
  const lyricSource = ref('')
  const lyricCandidates = ref([])
  const lyricCandidateId = ref('')
  const showTranslation = ref(loadFromStorage('bilimusic_show_translation', true))

  // Reference to the <audio> element (set by App.vue)
  let audioElement = null

  // --- Getters ---
  const currentTrack = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
      return playlist.value[currentIndex.value]
    }
    return null
  })

  // --- Persistence ---
  watch(playlist, (val) => saveToStorage(STORAGE_KEYS.playlist, val), { deep: true })
  watch(volume, (val) => { saveToStorage(STORAGE_KEYS.volume, val); if (audioElement) audioElement.volume = val })
  watch(playMode, (val) => saveToStorage(STORAGE_KEYS.playMode, val))

  // Persist showTranslation
  watch(showTranslation, (val) => saveToStorage('bilimusic_show_translation', val))

  // Watch for track changes to update desktop lyrics
  watch(currentTrack, (track) => {
    sendDesktopLyricsTrack()
  })
  watch(currentLyrics, (lyrics) => {
    sendDesktopLyricsUpdate()
  }, { deep: true })

  // --- Actions ---
  function setAudioElement(el) {
    audioElement = el
    if (audioElement) audioElement.volume = volume.value
  }

  function playTrack(track) {
    // 先清空当前状态，再切换歌曲
    clearCurrentState()
    const idx = playlist.value.findIndex((t) => t.bvid === track.bvid)
    if (idx >= 0) {
      currentIndex.value = idx
    } else {
      playlist.value.push(track)
      currentIndex.value = playlist.value.length - 1
    }
    loadAndPlay()
  }

  function addToPlaylist(track) {
    if (!playlist.value.find((t) => t.bvid === track.bvid)) {
      playlist.value.push(track)
    }
  }

  function playAtIndex(index) {
    if (index >= 0 && index < playlist.value.length) {
      clearCurrentState()
      currentIndex.value = index
      loadAndPlay()
    }
  }

  function removeFromPlaylist(index) {
    playlist.value.splice(index, 1)
    if (currentIndex.value === index) {
      if (playlist.value.length > 0) {
        currentIndex.value = Math.min(index, playlist.value.length - 1)
        loadAndPlay()
      } else {
        clearCurrentState()
        currentIndex.value = -1
      }
    } else if (currentIndex.value > index) {
      currentIndex.value--
    }
  }

  function clearPlaylist() {
    clearCurrentState()
    playlist.value = []
    currentIndex.value = -1
  }

  function toPlainObject(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

  function sendDesktopLyricsUpdate() {
    if (!window.electronAPI?.desktopLyricsUpdateLyrics) return
    window.electronAPI.desktopLyricsUpdateLyrics({
      lyrics: toPlainObject(currentLyrics.value),
      currentTime: currentTime.value
    })
  }

  function sendDesktopLyricsTime() {
    if (!window.electronAPI?.desktopLyricsUpdateTime) return
    window.electronAPI.desktopLyricsUpdateTime(currentTime.value)
  }

  function sendDesktopLyricsTrack() {
    if (!window.electronAPI?.desktopLyricsUpdateTrack) return
    const track = currentTrack.value
    if (!track) return
    window.electronAPI.desktopLyricsUpdateTrack(toPlainObject(track))
  }

  // Simple in-memory cache for lyrics and audio URLs
  // 使用 LRU (Least Recently Used) 淘汰策略
  const CACHE_LIMITS = {
    audio: loadFromStorage('bilimusic_cache_audio_limit', 100),
    lyric: loadFromStorage('bilimusic_cache_lyric_limit', 20),
  }

  function createLimitedCache(maxSize) {
    const map = new Map()
    return {
      get(key) {
        if (!map.has(key)) return undefined
        // 移到末尾（最近使用）
        const val = map.get(key)
        map.delete(key)
        map.set(key, val)
        return val
      },
      set(key, val) {
        if (map.has(key)) map.delete(key)
        else if (map.size >= maxSize) {
          // 删除最久未使用的（第一个）
          const oldest = map.keys().next().value
          map.delete(oldest)
        }
        map.set(key, val)
      },
      get size() { return map.size },
      get maxSize() { return maxSize },
      clear() { map.clear() },
      keys() { return map.keys() },
      entries() { return map.entries() },
    }
  }

  // 导出的缓存引用，供 SettingsView 读取
  let lyricCache = createLimitedCache(CACHE_LIMITS.lyric)
  let audioCache = createLimitedCache(CACHE_LIMITS.audio)

  function updateCacheLimits(audioMax, lyricMax) {
    // 重建缓存以应用新限制
    const oldAudio = audioCache
    const oldLyric = lyricCache
    audioCache = createLimitedCache(audioMax)
    lyricCache = createLimitedCache(lyricMax)
    // 将旧缓存中未超限的数据迁移过去
    for (const [k, v] of oldAudio.entries()) {
      if (audioCache.size < audioMax) audioCache.set(k, v)
    }
    for (const [k, v] of oldLyric.entries()) {
      if (lyricCache.size < lyricMax) lyricCache.set(k, v)
    }
    saveToStorage('bilimusic_cache_audio_limit', audioMax)
    saveToStorage('bilimusic_cache_lyric_limit', lyricMax)
  }

  function getCacheInfo() {
    return {
      audio: { size: audioCache.size, max: audioCache.maxSize },
      lyric: { size: lyricCache.size, max: lyricCache.maxSize },
    }
  }

  function clearAllCaches() {
    audioCache.clear()
    lyricCache.clear()
  }

  function clearLyricCache() {
    lyricCache.clear()
  }

  function clearCurrentState() {
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    currentLyrics.value = []
    lyricSource.value = ''
    lyricCandidates.value = []
    lyricCandidateId.value = ''
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
    }
    // 通知桌面歌词"未播放"
    sendDesktopLyricsUpdate()
    if (window.electronAPI?.desktopLyricsUpdateTrack) {
      window.electronAPI.desktopLyricsUpdateTrack(null)
    }
  }

  async function loadAndPlay() {
    const track = currentTrack.value
    if (!track || !audioElement) return

    clearCurrentState()

    try {
      let cid = track.cid === '0' ? null : track.cid
      // bvid 为空时也需要调用 getVideoInfo 拿到真实的 bvid
      if (!cid || !track.bvid) {
        const info = await window.electronAPI.getVideoInfo(track.bvid || '', track.aid || 0)
        if (info && info.cid) {
          cid = info.cid
          track.cid = cid
          track.bvid = info.bvid || track.bvid
          track.title = track.title || info.title
          track.cover = track.cover || info.cover
          track.duration = track.duration || info.duration
          track.author = track.author || info.author
        }
      }

      if (!cid) {
        console.error('No cid found for video')
        return
      }

      // 缓存音频 URL
      const audioCacheKey = `${track.bvid}_${cid}`
      let audioData = audioCache.get(audioCacheKey)
      if (!audioData) {
        audioData = await window.electronAPI.getAudioUrl(track.bvid, cid)
        if (audioData?.url) {
          audioCache.set(audioCacheKey, audioData)
        }
      }
      console.log(audioData)
      if (audioData?.url) {
        const proxyUrl = 'bili://' + encodeURIComponent(audioData.url)
        audioElement.src = proxyUrl
        await audioElement.play()
        isPlaying.value = true
        loadLyrics(track.bvid, cid, track.title)
        sendDesktopLyricsTrack()
      }
    } catch (e) {
      console.error('Failed to load audio:', e)
    }
  }

  async function loadLyrics(bvid, cid, title) {
    const keyword = extractKeyword(title)
    const lyricCacheKey = `${bvid}_${cid}`
    try {
      let result = lyricCache.get(lyricCacheKey)
      if (!result) {
        result = await window.electronAPI.getLyric(bvid, cid, keyword)
        if (result?.lyrics?.length > 0) {
          lyricCache.set(lyricCacheKey, result)
        }
      }
      currentLyrics.value = result.lyrics || []
      lyricSource.value = result.source || ''
    } catch {
      currentLyrics.value = []
      lyricSource.value = ''
    }

    sendDesktopLyricsUpdate()

    // 已有歌词（本地文件/字幕），不再搜索在线候选
    if (currentLyrics.value.length > 0) {
      lyricCandidates.value = []
      return
    }

    if (keyword) {
      try {
        const candidates = await window.electronAPI.searchLyricCandidates(keyword)
        lyricCandidates.value = candidates || []
        // 首次播放无歌词时自动拉取第一个候选并塞入缓存
        if (lyricCandidates.value.length > 0) {
          const first = lyricCandidates.value[0]
          const autoResult = await window.electronAPI.fetchLyric(first.source, first.id)
          if (autoResult?.lyrics?.length) {
            currentLyrics.value = autoResult.lyrics
            lyricSource.value = autoResult.source
            lyricCandidateId.value = first.id
            // 缓存结果（不生成本地文件）
            lyricCache.set(lyricCacheKey, { source: autoResult.source, lyrics: autoResult.lyrics })
            sendDesktopLyricsUpdate()
          }
        }
      } catch {
        lyricCandidates.value = []
      }
    } else {
      lyricCandidates.value = []
    }
  }

  async function selectLyricCandidate(source, id) {
    try {
      if (source === 'subtitle') {
        const track = currentTrack.value
        if (track?.bvid) {
          const result = await window.electronAPI.getLyric(track.bvid, track.cid || '', track.title)
          if (result?.lyrics) {
            currentLyrics.value = result.lyrics
            lyricSource.value = result.source
            lyricCandidateId.value = id
            sendDesktopLyricsUpdate()
            return
          }
        }
      }
      const result = await window.electronAPI.fetchLyric(source, id)
      if (result && result.lyrics) {
        currentLyrics.value = result.lyrics
        lyricSource.value = result.source
        lyricCandidateId.value = id
        sendDesktopLyricsUpdate()
      }
    } catch {
      // keep current lyrics
    }
  }

  function togglePlay() {
    if (!currentTrack.value) return
    if (!audioElement) return
    if (!audioElement.src) return

    if (isPlaying.value) {
      audioElement.pause()
    } else {
      audioElement.play().catch(() => {})
    }
    isPlaying.value = !isPlaying.value
  }

  function nextTrack() {
    if (playlist.value.length === 0) return
    if (playMode.value === 1) {
      let next
      do { next = Math.floor(Math.random() * playlist.value.length) }
      while (next === currentIndex.value && playlist.value.length > 1)
      currentIndex.value = next
    } else {
      currentIndex.value = (currentIndex.value + 1) % playlist.value.length
    }
    loadAndPlay()
  }

  function prevTrack() {
    if (playlist.value.length === 0) return
    if (currentTime.value > 3) { seek(0); return }

    if (playMode.value === 1) {
      let prev
      do { prev = Math.floor(Math.random() * playlist.value.length) }
      while (prev === currentIndex.value && playlist.value.length > 1)
      currentIndex.value = prev
    } else {
      currentIndex.value = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length
    }
    loadAndPlay()
  }

  function seek(time) {
    if (audioElement) audioElement.currentTime = time
  }

  function setVolume(val) {
    volume.value = val
  }

  function cyclePlayMode() {
    playMode.value = (playMode.value + 1) % 3
  }

  function updateTime(time) {
    currentTime.value = time
    sendDesktopLyricsTime()
  }

  function setDuration(val) {
    duration.value = val
  }

  function onEnded() {
    if (playMode.value === 2) {
      seek(0)
      audioElement?.play()
    } else {
      nextTrack()
    }
  }

  function toggleTranslation() {
    showTranslation.value = !showTranslation.value
  }

  return {
    playlist, currentIndex, isPlaying, currentTime, duration,
    volume, playMode, currentLyrics, lyricSource, lyricCandidates,
    lyricCandidateId, showTranslation,
    currentTrack, audioElement,
    setAudioElement, playTrack, addToPlaylist, playAtIndex,
    removeFromPlaylist, clearPlaylist, loadAndPlay,
    togglePlay, nextTrack, prevTrack, seek, setVolume,
    cyclePlayMode, updateTime, setDuration, onEnded,
    loadLyrics, selectLyricCandidate, toggleTranslation,
    updateCacheLimits, getCacheInfo, clearAllCaches, clearLyricCache
  }
})

function extractKeyword(title) {
  if (!title) return ''
  const patterns = [/《(.+?)》/, /【(.+?)】/, /「(.+?)」/, /"(.+?)"/]
  for (const p of patterns) {
    const m = title.match(p)
    if (m) return m[1].trim()
  }
  return title.trim()
}

function loadFromStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : fallback
  } catch { return fallback }
}

function saveToStorage(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}
