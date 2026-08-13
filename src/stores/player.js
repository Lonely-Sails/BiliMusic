/**
 * Player Store — 播放器核心状态管理
 *
 * 数据流：
 *   App.vue 的 <audio> 元素 ↔ player store ↔ IPC → Electron 主进程
 *
 * 覆盖：播放队列与音频控制、歌词加载与候选选择、音频源解析与缓存、
 *       桌面歌词窗口同步（原 player-lyrics / player-source / desktop-lyrics-sync 已并入）
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { usePlayerAudio } from '../composables/use_player_audio';
import { usePlayerQueue } from '../composables/use_player_queue';
import { createAudioUrlCache } from '../utils/audio-url-cache';
import { clearGainCache } from '../utils/loudness';

const STORAGE_KEYS = {
  playlist: 'bilimusic_playlist',
  volume: 'bilimusic_volume',
  playMode: 'bilimusic_playmode',
  loudness: 'bilimusic_loudness',
  searchMusicOnly: 'bilimusic_search_music_only',
};

/** 桌面歌词时间同步节流阈值（秒） */
const TIME_THROTTLE_SECONDS = 0.15;

export const usePlayerStore = defineStore('player', () => {
  // ══════════════════════════════════════════
  //  状态
  // ══════════════════════════════════════════

  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const playMode = ref(loadFromStorage(STORAGE_KEYS.playMode, 0)); // 0=顺序 1=随机 2=单曲
  const showTranslation = ref(loadFromStorage('bilimusic_show_translation', true));
  const searchMusicOnly = ref(loadFromStorage(STORAGE_KEYS.searchMusicOnly, true));

  // ── 歌词状态 ──
  const currentLyrics = ref([]);
  const lyricSource = ref('');
  const lyricFileName = ref('');
  const lyricCandidates = ref([]);
  const lyricCandidateId = ref('');

  // ── 音频源缓存 ──
  const audioUrlCache = createAudioUrlCache();

  // ── 桌面歌词同步节流 ──
  let lastLyrics = null;
  let lastTime = -1;

  /** loadAndPlay 序列号，用于防止并发竞态 */
  let _loadSeq = 0;
  const {
    audioElement,
    volume,
    loudnessEnabled,
    setAudioElement,
    initLoudnessNormalizer,
    fadeOut,
    normalizeTrack,
    setVolume,
  } = usePlayerAudio({
    initialVolume: loadFromStorage(STORAGE_KEYS.volume, 0.7),
    initialLoudnessEnabled: loadFromStorage(STORAGE_KEYS.loudness, false),
    onSaveVolume: (value) => saveToStorage(STORAGE_KEYS.volume, value),
    onSaveLoudness: (value) => saveToStorage(STORAGE_KEYS.loudness, value),
  });

  const {
    playlist,
    currentIndex,
    currentTrack,
    playTrack,
    addToPlaylist,
    playAtIndex,
    removeFromPlaylist,
    clearPlaylist,
  } = usePlayerQueue({
    initialPlaylist: loadFromStorage(STORAGE_KEYS.playlist, []),
    onLoad: () => loadAndPlay(),
    onClear: () => clearCurrentState(),
    onSave: (value) => saveToStorage(STORAGE_KEYS.playlist, value),
  });

  // ══════════════════════════════════════════
  //  持久化 watch
  //  playlist 仅监听引用变化（增删改操作中显式保存）
  // ══════════════════════════════════════════

  watch(playlist, (val) => saveToStorage(STORAGE_KEYS.playlist, val), {
    deep: false,
  });
  watch(playMode, (val) => saveToStorage(STORAGE_KEYS.playMode, val));
  watch(showTranslation, (val) => saveToStorage('bilimusic_show_translation', val));
  watch(searchMusicOnly, (val) => saveToStorage(STORAGE_KEYS.searchMusicOnly, val));

  watch(playlist, () => clearGainCache(), { deep: false });
  watch(currentTrack, (track) => syncTrack(track));
  // 歌词变化 → 同步（仅监听引用变化，切歌时触发）
  watch(currentLyrics, (lyrics) => syncLyrics(lyrics, currentTime.value), { deep: false });

  // ── 歌词方法 ──
  function clearLyrics() {
    currentLyrics.value = [];
    lyricSource.value = '';
    lyricCandidates.value = [];
    lyricCandidateId.value = '';
  }

  async function loadLyrics(bvid, cid, title) {
    try {
      const result = await window.electronAPI.getLyric(bvid, cid, title);
      currentLyrics.value = result.lyrics || [];
      lyricSource.value = result.source || '';
      lyricCandidates.value = [];
      lyricFileName.value = '';

      if (result?.source === 'local' && window.electronAPI?.listLocalLyrics) {
        const localFiles = await window.electronAPI.listLocalLyrics();
        const keyword = (title || '').toLowerCase();
        const matched = localFiles.find((file) => {
          const fileName = file.fileName.replace('.lrc', '').toLowerCase();
          const songName = (file.song || '').toLowerCase();
          return (
            songName === keyword ||
            fileName === keyword ||
            songName.includes(keyword) ||
            keyword.includes(songName)
          );
        });
        if (matched) lyricFileName.value = matched.fileName;
      }
    } catch {
      clearLyrics();
    }
  }

  async function selectLyricCandidate(source, id) {
    try {
      const result = await window.electronAPI.fetchLyric(source, id);
      if (!result?.lyrics) return;
      currentLyrics.value = result.lyrics;
      lyricSource.value = result.source;
      lyricCandidateId.value = id;
    } catch {
      // 候选歌词加载失败时保留当前已显示的歌词
    }
  }

  // ── 音频源解析与缓存 ──
  async function resolveSource(track) {
    let cid = track.cid === '0' ? null : track.cid;
    if (!cid || !track.bvid) {
      const info = await window.electronAPI.getVideoInfo(track.bvid || '', track.aid || 0);
      if (info?.cid) {
        cid = info.cid;
        track.cid = cid;
        track.bvid = info.bvid || track.bvid;
        track.title = track.title || info.title;
        track.cover = track.cover || info.cover;
        track.duration = track.duration || info.duration;
        track.author = track.author || info.author;
      }
    }

    if (!cid) return null;
    const cacheKey = `${track.bvid}_${cid}`;
    let audioData = audioUrlCache.get(cacheKey);
    if (!audioData) {
      audioData = await window.electronAPI.getAudioUrl(track.bvid, cid);
      if (audioData?.url) audioUrlCache.set(cacheKey, audioData);
    }

    return { cid, cacheKey, audioData };
  }

  function getAudioCacheInfo() {
    return audioUrlCache.getInfo();
  }

  function clearAudioCache() {
    audioUrlCache.clear();
  }

  // ── 桌面歌词同步 ──
  function syncLyrics(lyrics, time) {
    if (!window.electronAPI?.desktopLyricsUpdateLyrics) return;
    if (lyrics === lastLyrics) return;
    lastLyrics = lyrics;
    window.electronAPI.desktopLyricsUpdateLyrics({
      lyrics: toPlainObject(lyrics),
      currentTime: time,
    });
  }

  function syncTime(time) {
    if (Math.abs(time - lastTime) < TIME_THROTTLE_SECONDS) return;
    lastTime = time;
    window.electronAPI?.desktopLyricsUpdateTime?.(time);
  }

  function syncTrack(track) {
    if (!track) return;
    window.electronAPI?.desktopLyricsUpdateTrack?.(toPlainObject(track));
  }

  function resetDesktopLyrics(lyrics, time) {
    lastLyrics = null;
    lastTime = -1;
    syncLyrics(lyrics, time);
    window.electronAPI?.desktopLyricsUpdateTrack?.(null);
  }

  function clearCurrentState() {
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    clearLyrics();
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value.src = '';
    }
    resetDesktopLyrics(currentLyrics.value, currentTime.value);
  }

  async function loadAndPlay() {
    // 递增序列号，用于弃掉过时的异步结果
    const seq = ++_loadSeq;

    const track = currentTrack.value;
    if (!track || !audioElement.value) return;

    // 仅当正在播放时才做淡出过渡（首次播放/已暂停时跳过，避免多余的等待）
    if (!audioElement.value.paused) await fadeOut();

    clearCurrentState();

    try {
      const source = await resolveSource(track);
      if (!source) {
        console.error('[BiliMusic] No cid found for video');
        return;
      }
      if (seq !== _loadSeq) return;

      if (source.audioData?.url) {
        // 直接加载 CDN 流地址（Referer/CORS 由主进程 webRequest 拦截注入）
        // <audio> 本身边下载边播放：不阻塞等待首帧，立即进入播放态
        audioElement.value.src = source.audioData.url;
        isPlaying.value = true;
        audioElement.value.play().catch(() => {
          if (seq === _loadSeq) {
            console.error('[BiliMusic] Failed to start playback');
            isPlaying.value = false;
          }
        });

        // 以下为出声后的后台任务，不阻塞播放
        normalizeTrack(source.cacheKey).catch((e) =>
          console.error('[BiliMusic] Loudness normalize failed:', e)
        );
        loadLyrics(track.bvid, source.cid, track.title);
        syncTrack(track);
      }
    } catch (e) {
      if (seq !== _loadSeq) return;
      console.error('[BiliMusic] Failed to load audio:', e);
    }
  }

  function togglePlay() {
    if (!currentTrack.value) return;
    if (!audioElement.value?.src) return;

    if (isPlaying.value) {
      audioElement.value.pause();
    } else {
      audioElement.value.play().catch(() => {});
    }
    isPlaying.value = !isPlaying.value;
  }

  function nextTrack() {
    if (playlist.value.length === 0) return;
    if (playMode.value === 1) {
      let next;
      do {
        next = Math.floor(Math.random() * playlist.value.length);
      } while (next === currentIndex.value && playlist.value.length > 1);
      currentIndex.value = next;
    } else {
      currentIndex.value = (currentIndex.value + 1) % playlist.value.length;
    }
    loadAndPlay();
  }

  function prevTrack() {
    if (playlist.value.length === 0) return;
    if (currentTime.value > 3) {
      seek(0);
      return;
    }

    if (playMode.value === 1) {
      let prev;
      do {
        prev = Math.floor(Math.random() * playlist.value.length);
      } while (prev === currentIndex.value && playlist.value.length > 1);
      currentIndex.value = prev;
    } else {
      currentIndex.value = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length;
    }
    loadAndPlay();
  }

  function seek(time) {
    if (audioElement.value) audioElement.value.currentTime = time;
  }

  function cyclePlayMode() {
    playMode.value = (playMode.value + 1) % 3;
  }

  function updateTime(time) {
    currentTime.value = time;
    syncTime(time);
  }

  function setDuration(val) {
    duration.value = val;
  }

  function onEnded() {
    if (playMode.value === 2) {
      seek(0);
      audioElement.value?.play();
    } else {
      nextTrack();
    }
  }

  function toggleTranslation() {
    showTranslation.value = !showTranslation.value;
  }

  return {
    playlist,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    playMode,
    currentLyrics,
    lyricSource,
    lyricFileName,
    lyricCandidates,
    lyricCandidateId,
    showTranslation,
    loudnessEnabled,
    searchMusicOnly,
    currentTrack,
    audioElement,
    setAudioElement,
    initLoudnessNormalizer,
    playTrack,
    addToPlaylist,
    playAtIndex,
    removeFromPlaylist,
    clearPlaylist,
    loadAndPlay,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    cyclePlayMode,
    updateTime,
    setDuration,
    onEnded,
    loadLyrics,
    selectLyricCandidate,
    toggleTranslation,
    getAudioCacheInfo,
    clearAudioCache,
  };
});

function loadFromStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

function toPlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}
