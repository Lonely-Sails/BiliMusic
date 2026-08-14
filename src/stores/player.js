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
import { ref, watch, toRaw } from 'vue';
import { usePlayerAudio } from '../composables/use_player_audio';
import { usePlayerQueue } from '../composables/use_player_queue';
import { createAudioUrlCache } from '../utils/audio-url-cache';
import { clearGainCache } from '../utils/loudness';
import { useUserStore } from './user';
import { useToast } from './toast';

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
  // toast 为模块级单例（非 Pinia store），可安全顶部实例化
  const toast = useToast();

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
  /** 最近一次真正设置 audio.src 的加载序列号（用于过滤旧曲目的异步错误） */
  let _activeLoadSeq = 0;
  /** src 代际计数 — 每次重设 audio.src 递增，用于过滤旧 play() 的过期 rejection */
  let _srcGeneration = 0;
  /** 当前曲目连续播放失败次数（第 1 次强制重解析 URL，之后自动下一曲） */
  let _playAttempt = 0;
  /** 同一失败信号去重（error 事件与 play() rejection 会双双触发） */
  let _handlingError = false;
  /** 登录过期检测节流 */
  let _lastAuthCheckTime = 0;
  let _authCheckInFlight = false;
  /** 歌词的非响应式原始引用 — IPC 直传原始数组，避免深拷贝与 Vue Proxy 序列化问题 */
  const ipcLyricsRef = { value: [] };
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
  watch(currentTrack, syncTrack);
  // 歌词变化 → 同步（仅监听引用变化，切歌时触发）
  watch(currentLyrics, () => syncLyrics(currentTime.value), { deep: false });

  // ── 歌词方法 ──
  /** 更新歌词：同时维护响应式状态与非响应式 IPC 原始引用 */
  function setLyrics(lyrics) {
    currentLyrics.value = lyrics;
    ipcLyricsRef.value = lyrics;
  }

  function clearLyrics() {
    setLyrics([]);
    lyricSource.value = '';
    lyricCandidates.value = [];
    lyricCandidateId.value = '';
  }

  async function loadLyrics(bvid, cid, title) {
    try {
      const result = await window.electronAPI.getLyric(bvid, cid, title);
      setLyrics(result.lyrics || []);
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
      setLyrics(result.lyrics);
      lyricSource.value = result.source;
      lyricCandidateId.value = id;
    } catch {
      // 候选歌词加载失败时保留当前已显示的歌词
    }
  }

  // ── 音频源解析与缓存 ──
  async function resolveSource(track, { force = false } = {}) {
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
    // 播放失败重试时强制绕过缓存重新解析（签名 URL 可能已失效）
    let audioData = force ? undefined : audioUrlCache.get(cacheKey);
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
  // 歌词/曲目为只读数据，直接传原始引用走 IPC（结构化克隆自动处理），
  // 避免 JSON.parse(JSON.stringify()) 全量深拷贝；歌词更新由 setLyrics 同步维护原始引用
  function syncLyrics(time) {
    if (!window.electronAPI?.desktopLyricsUpdateLyrics) return;
    const raw = ipcLyricsRef.value;
    if (raw === lastLyrics) return;
    lastLyrics = raw;
    window.electronAPI.desktopLyricsUpdateLyrics({
      lyrics: raw,
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
    // toRaw 解开响应式代理，只读曲目信息直接传引用
    window.electronAPI?.desktopLyricsUpdateTrack?.(toRaw(track));
  }

  function resetDesktopLyrics(time) {
    lastLyrics = null;
    lastTime = -1;
    syncLyrics(time);
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
      // 清空 src 也是一次新的加载请求，递增代际以作废 pending 的 play()
      _srcGeneration += 1;
    }
    resetDesktopLyrics(0);
  }

  async function loadAndPlay() {
    // 递增序列号，用于弃掉过时的异步结果
    const seq = ++_loadSeq;

    const track = currentTrack.value;
    if (!track || !audioElement.value) return;

    // 仅当正在播放时才做淡出过渡（首次播放/已暂停时跳过，避免多余的等待）
    if (!audioElement.value.paused) await fadeOut();

    clearCurrentState();
    // src 清空后即视为本次加载接管中，后续 audio error 归本序列处理
    _activeLoadSeq = seq;
    _playAttempt = 0;
    _handlingError = false;

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
        const generation = ++_srcGeneration;
        audioElement.value.play().catch((e) => {
          // src 已被新的加载请求接管（切歌/重试/清空），旧 rejection 一律忽略（含 AbortError）
          if (generation !== _srcGeneration) return;
          console.error('[BiliMusic] Failed to start playback:', e);
          // 自动播放策略限制（需用户手势）不进入重试循环，其余失败走统一恢复流程
          if (e?.name === 'NotAllowedError') {
            isPlaying.value = false;
            return;
          }
          handleAudioError();
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
      // 音频源解析失败（如 playurl 返回 403/401）→ 顺带检测登录态
      handleAuthFailure();
      handleAudioError();
    }
  }

  /**
   * 播放失败统一恢复流程：
   *  第 1 次失败 → 清缓存强制重新解析音频 URL（签名过期/临时 403 常见）
   *  连续失败   → 自动下一曲（单曲队列则停止并提示）
   * error 事件与 play() rejection 会对同一失败双双触发，用 _handlingError 去重
   */
  async function handleAudioError() {
    if (_handlingError || _loadSeq !== _activeLoadSeq) return;
    _handlingError = true;
    isPlaying.value = false;

    const track = currentTrack.value;
    if (!track || !audioElement.value) {
      _handlingError = false;
      return;
    }

    _playAttempt += 1;
    if (_playAttempt === 1) {
      try {
        const source = await resolveSource(track, { force: true });
        if (_loadSeq !== _activeLoadSeq || !audioElement.value) {
          // 期间已切歌/清空，释放失败标志，避免后续错误被永久吞掉
          _handlingError = false;
          return;
        }
        if (!source?.audioData?.url) throw new Error('No audio URL after re-resolve');

        audioElement.value.src = source.audioData.url;
        _handlingError = false; // 新 src 开启新的失败周期
        isPlaying.value = true;
        const generation = ++_srcGeneration;
        audioElement.value.play().catch((e) => {
          // src 已被再次替换（如用户切歌），旧 rejection 不再属于当前加载（含 AbortError）
          if (generation !== _srcGeneration) return;
          if (e?.name === 'NotAllowedError') {
            isPlaying.value = false;
            return;
          }
          handleAudioError();
        });
      } catch (e) {
        if (_loadSeq !== _activeLoadSeq) return;
        console.error('[BiliMusic] Audio retry failed:', e);
        autoNextAfterFailure();
      }
    } else {
      autoNextAfterFailure();
    }
  }

  function autoNextAfterFailure() {
    if (playlist.value.length > 1) {
      nextTrack();
    } else {
      // 单曲队列无后备：停止并提示
      console.error('[BiliMusic] Playback failed, no fallback track');
      toast.showToast('播放失败：音频无法加载', 'error');
    }
  }

  /**
   * 登录态过期检测 — 播放 403 时触发一次，节流 60s，仅在确认未登录时提示
   */
  async function handleAuthFailure() {
    const now = Date.now();
    if (now - _lastAuthCheckTime < 60_000 || _authCheckInFlight) return;
    _lastAuthCheckTime = now;
    _authCheckInFlight = true;
    try {
      const userStore = useUserStore();
      const result = await userStore.checkLogin();
      if (result && !result.loggedIn) {
        toast.showToast('登录状态已过期，请重新登录', 'error');
      }
    } catch (e) {
      console.error('[BiliMusic] Auth check failed:', e);
    } finally {
      _authCheckInFlight = false;
    }
  }

  function togglePlay() {
    if (!currentTrack.value) return;
    if (!audioElement.value?.src) return;

    if (isPlaying.value) {
      audioElement.value.pause();
      isPlaying.value = false;
    } else {
      isPlaying.value = true;
      const generation = _srcGeneration;
      audioElement.value.play().catch((e) => {
        // 恢复期间 src 已被替换（切歌/重试/清空），旧 rejection 由新加载负责（含 AbortError）
        if (generation !== _srcGeneration) return;
        console.error('[BiliMusic] Resume playback failed:', e);
        if (audioElement.value?.error) {
          // 元素已处于错误状态（如之前加载失败）→ 走统一恢复流程
          handleAudioError();
        } else {
          isPlaying.value = false;
        }
      });
    }
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
      const generation = _srcGeneration;
      audioElement.value?.play().catch(() => {
        // 期间已发生新的加载（含 AbortError 中断），由新加载负责
        if (generation !== _srcGeneration) return;
        handleAudioError();
      });
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
    handleAudioError,
    handleAuthFailure,
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
