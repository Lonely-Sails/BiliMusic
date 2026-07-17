/**
 * Player Store — 播放器核心状态管理
 *
 * 职责：
 * - 播放列表管理（增删改、持久化到 localStorage）
 * - 音频播放控制（关联 <audio> 元素）
 * - 歌词获取和缓存（本地/字幕/在线）
 * - 音频 URL 缓存（避免重复请求）
 * - 桌面歌词数据同步
 *
 * 数据流：
 *   App.vue 的 <audio> 元素 ↔ player store ↔ IPC → Electron 主进程
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { LoudnessNormalizer, clearGainCache } from '../utils/loudness';

const STORAGE_KEYS = {
	playlist: 'bilimusic_playlist',
	volume: 'bilimusic_volume',
	playMode: 'bilimusic_playmode',
	loudness: 'bilimusic_loudness',
};

export const usePlayerStore = defineStore('player', () => {
	// ══════════════════════════════════════════
	//  状态
	// ══════════════════════════════════════════

	const playlist = ref(loadFromStorage(STORAGE_KEYS.playlist, []));
	const currentIndex = ref(-1);
	const isPlaying = ref(false);
	const currentTime = ref(0);
	const duration = ref(0);
	const volume = ref(loadFromStorage(STORAGE_KEYS.volume, 0.7));
	const playMode = ref(loadFromStorage(STORAGE_KEYS.playMode, 0)); // 0=顺序 1=随机 2=单曲
	const currentLyrics = ref([]); // 当前歌词行 [{time, text, trans}]
	const lyricSource = ref(''); // 歌词来源: local/subtitle/qq/netease
	const lyricFileName = ref(''); // 本地 LRC 文件名
	const lyricCandidates = ref([]); // 歌词候选列表
	const lyricCandidateId = ref('');
	const showTranslation = ref(
		loadFromStorage('bilimusic_show_translation', true),
	);
	const loudnessEnabled = ref(
		loadFromStorage(STORAGE_KEYS.loudness, false),
	);

	/** <audio> 元素引用（由 App.vue 的 onMounted 设置） */
	let audioElement = null;
	/** 音量均衡器实例（惰性初始化） */
	let loudnessNormalizer = null;
	/** loadAndPlay 序列号，用于防止并发竞态 */
	let _loadSeq = 0;

	// ══════════════════════════════════════════
	//  计算属性
	// ══════════════════════════════════════════

	/** 当前播放的曲目 */
	const currentTrack = computed(() => {
		if (
			currentIndex.value >= 0 &&
			currentIndex.value < playlist.value.length
		) {
			return playlist.value[currentIndex.value];
		}
		return null;
	});

	// ══════════════════════════════════════════
	//  持久化 watch
	//  playlist 仅监听引用变化（增删改操作中显式保存）
	// ══════════════════════════════════════════

	watch(playlist, (val) => saveToStorage(STORAGE_KEYS.playlist, val), {
		deep: false,
	});
	watch(volume, (val) => {
		saveToStorage(STORAGE_KEYS.volume, val);
		if (audioElement) {
			if (loudnessEnabled.value && loudnessNormalizer?.ready) {
				loudnessNormalizer.setUserVolume(val);
			} else if (!loudnessEnabled.value || !loudnessNormalizer?.ready) {
				audioElement.volume = val;
			}
		}
	});
	watch(playMode, (val) => saveToStorage(STORAGE_KEYS.playMode, val));
	watch(showTranslation, (val) =>
		saveToStorage('bilimusic_show_translation', val),
	);
	watch(loudnessEnabled, async (val) => {
		saveToStorage(STORAGE_KEYS.loudness, val);
		if (!audioElement) return;
		if (val) {
			initLoudnessNormalizer();
			await loudnessNormalizer?.enable(volume.value);
		} else {
			loudnessNormalizer?.disable(volume.value);
		}
	});

	watch(playlist, () => clearGainCache(), { deep: false })
	watch(currentTrack, () => sendDesktopLyricsTrack());
	// 歌词变化 → 同步（仅监听引用变化，切歌时触发）
	watch(currentLyrics, () => sendDesktopLyricsUpdate(), { deep: false });

	// --- Actions ---
	function initLoudnessNormalizer() {
		if (loudnessNormalizer || !audioElement) return
		loudnessNormalizer = new LoudnessNormalizer(audioElement)
		loudnessNormalizer.init()
	}

	async function setAudioElement(element) {
		audioElement = element
		if (!audioElement) return
		audioElement.crossOrigin = 'anonymous'
		if (loudnessEnabled.value) {
			initLoudnessNormalizer()
			await loudnessNormalizer?.enable(volume.value)
		} else {
			audioElement.volume = volume.value
		}
	}

	function playTrack(track) {
		const idx = playlist.value.findIndex((t) => t.bvid === track.bvid);
		if (idx >= 0) {
			currentIndex.value = idx;
		} else {
			playlist.value.push(track);
			currentIndex.value = playlist.value.length - 1;
		}
		loadAndPlay();
	}

	function addToPlaylist(track) {
		if (!playlist.value.find((t) => t.bvid === track.bvid)) {
			playlist.value.push(track);
			saveToStorage(STORAGE_KEYS.playlist, playlist.value);
		}
	}

	function playAtIndex(index) {
		if (index >= 0 && index < playlist.value.length) {
			currentIndex.value = index;
			loadAndPlay();
		}
	}

	function removeFromPlaylist(index) {
		playlist.value.splice(index, 1);
		saveToStorage(STORAGE_KEYS.playlist, playlist.value);
		if (currentIndex.value === index) {
			if (playlist.value.length > 0) {
				currentIndex.value = Math.min(index, playlist.value.length - 1);
				loadAndPlay();
			} else {
				clearCurrentState();
				currentIndex.value = -1;
			}
		} else if (currentIndex.value > index) {
			currentIndex.value--;
		}
	}

	function clearPlaylist() {
		clearCurrentState();
		playlist.value = [];
		currentIndex.value = -1;
		saveToStorage(STORAGE_KEYS.playlist, []);
	}

	function toPlainObject(obj) {
		return JSON.parse(JSON.stringify(obj));
	}

	// 上次发送的歌词引用，用于去重
	let lastSentLyrics = null;

	function sendDesktopLyricsUpdate() {
		if (!window.electronAPI?.desktopLyricsUpdateLyrics) return;
		const lyricsArr = currentLyrics.value;
		// 歌词没变就不重复发送完整数据
		if (lyricsArr === lastSentLyrics) return;
		lastSentLyrics = lyricsArr;
		window.electronAPI.desktopLyricsUpdateLyrics({
			lyrics: toPlainObject(lyricsArr),
			currentTime: currentTime.value,
		});
	}

	function sendDesktopLyricsTime() {
		if (!window.electronAPI?.desktopLyricsUpdateTime) return;
		window.electronAPI.desktopLyricsUpdateTime(currentTime.value);
	}

	function sendDesktopLyricsTrack() {
		if (!window.electronAPI?.desktopLyricsUpdateTrack) return;
		const track = currentTrack.value;
		if (!track) return;
		window.electronAPI.desktopLyricsUpdateTrack(toPlainObject(track));
	}

	// ── Audio URL Cache (LRU) ──
	// API 响应缓存已统一由主进程 apiGet 管理
	// 此处仅缓存音频 URL（bvid_cid → audioData），避免重复请求
	const AUDIO_CACHE_MAX = 200;
	const audioCache = new Map();

	function audioCacheGet(key) {
		if (!audioCache.has(key)) return undefined;
		const val = audioCache.get(key);
		audioCache.delete(key);
		audioCache.set(key, val);
		return val;
	}

	function audioCacheSet(key, val) {
		if (audioCache.has(key)) audioCache.delete(key);
		else if (audioCache.size >= AUDIO_CACHE_MAX) {
			const oldest = audioCache.keys().next().value;
			audioCache.delete(oldest);
		}
		audioCache.set(key, val);
	}

	function getAudioCacheInfo() {
		return { size: audioCache.size, max: AUDIO_CACHE_MAX };
	}

	function clearAudioCache() {
		audioCache.clear();
	}

	function clearCurrentState() {
		isPlaying.value = false;
		currentTime.value = 0;
		duration.value = 0;
		currentLyrics.value = [];
		lyricSource.value = '';
		lyricCandidates.value = [];
		lyricCandidateId.value = '';
		lastSentTime = -1;
		lastSentLyrics = null;
		if (audioElement) {
			audioElement.pause();
			audioElement.src = '';
		}
		// 通知桌面歌词"未播放"
		sendDesktopLyricsUpdate();
		if (window.electronAPI?.desktopLyricsUpdateTrack) {
			window.electronAPI.desktopLyricsUpdateTrack(null);
		}
	}

	async function loadAndPlay() {
		// 递增序列号，用于弃掉过时的异步结果
		const seq = ++_loadSeq;

		const track = currentTrack.value;
		if (!track || !audioElement) return;

		// ── 淡出当前音频（切歌时平滑过渡）──
		if (loudnessEnabled.value && loudnessNormalizer?.ready) {
			await loudnessNormalizer.fadeOut(200)
		}

		clearCurrentState();

		try {
			let cid = track.cid === '0' ? null : track.cid;
			if (!cid || !track.bvid) {
				const info = await window.electronAPI.getVideoInfo(
					track.bvid || '',
					track.aid || 0,
				);
				if (info && info.cid) {
					cid = info.cid;
					track.cid = cid;
					track.bvid = info.bvid || track.bvid;
					track.title = track.title || info.title;
					track.cover = track.cover || info.cover;
					track.duration = track.duration || info.duration;
					track.author = track.author || info.author;
				}
			}

			if (!cid) {
				console.error('[BiliMusic] No cid found for video');
				return;
			}

			const audioCacheKey = `${track.bvid}_${cid}`;
			let audioData = audioCacheGet(audioCacheKey);
			if (!audioData) {
				audioData = await window.electronAPI.getAudioUrl(
					track.bvid,
					cid,
				);
				if (audioData?.url) {
					audioCacheSet(audioCacheKey, audioData);
				}
			}
			if (seq !== _loadSeq) return;

			if (audioData?.url) {
				const proxyUrl = 'bili://audio/' + encodeURIComponent(audioData.url);
				audioElement.src = proxyUrl;
				await audioElement.play();
				if (seq !== _loadSeq) {
					audioElement.pause();
					audioElement.src = '';
					return;
				}
				isPlaying.value = true;

				// 新曲目 → 重新触发音量均衡（传入 songKey 以利用缓存）
				if (loudnessEnabled.value) {
					initLoudnessNormalizer();
					await loudnessNormalizer?.enable(volume.value, audioCacheKey);
				}

				loadLyrics(track.bvid, cid, track.title);
				sendDesktopLyricsTrack();
			}
		} catch (e) {
			if (seq !== _loadSeq) return;
			console.error('[BiliMusic] Failed to load audio:', e);
		}
	}

	async function loadLyrics(bvid, cid, title) {
		try {
			// 后端 IPC 内部会：
			// 1. 获取视频信息（含 bgm_info）提取最佳搜索词
			// 2. 检查本地文件
			// 3. 按相似度排序在线搜索
			//    （B站 AI 字幕已禁用）
			const result = await window.electronAPI.getLyric(bvid, cid, title);
			currentLyrics.value = result.lyrics || [];
			lyricSource.value = result.source || '';
			lyricCandidates.value = [];

			// 记录原始 LRC 文件名
			lyricFileName.value = '';
			if (
				result?.source === 'local' &&
				window.electronAPI?.listLocalLyrics
			) {
				try {
					const localFiles =
						await window.electronAPI.listLocalLyrics();
					const kw = (title || '').toLowerCase();
					const matched = localFiles.find((f) => {
						const fName = f.fileName
							.replace('.lrc', '')
							.toLowerCase();
						const fSong = (f.song || '').toLowerCase();
						return (
							fSong === kw ||
							fName === kw ||
							fSong.includes(kw) ||
							kw.includes(fSong)
						);
					});
					if (matched) lyricFileName.value = matched.fileName;
				} catch {}
			}
		} catch {
			currentLyrics.value = [];
			lyricSource.value = '';
			lyricCandidates.value = [];
		}

		sendDesktopLyricsUpdate();
	}

	async function selectLyricCandidate(source, id) {
		try {
			// B站字幕已禁用
			// if (source === 'subtitle') {
			// 	const track = currentTrack.value;
			// 	if (track?.bvid) {
			// 		const result = await window.electronAPI.getLyric(
			// 			track.bvid,
			// 			track.cid || '',
			// 			track.title,
			// 		);
			// 		if (result?.lyrics) {
			// 			currentLyrics.value = result.lyrics;
			// 			lyricSource.value = result.source;
			// 			lyricCandidateId.value = id;
			// 			sendDesktopLyricsUpdate();
			// 			return;
			// 		}
			// 	}
			// }
			const result = await window.electronAPI.fetchLyric(source, id);
			if (result && result.lyrics) {
				currentLyrics.value = result.lyrics;
				lyricSource.value = result.source;
				lyricCandidateId.value = id;
				sendDesktopLyricsUpdate();
			}
		} catch {
			// keep current lyrics
		}
	}

	function togglePlay() {
		if (!currentTrack.value) return;
		if (!audioElement) return;
		if (!audioElement.src) return;

		if (isPlaying.value) {
			audioElement.pause();
		} else {
			audioElement.play().catch(() => {});
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
			currentIndex.value =
				(currentIndex.value + 1) % playlist.value.length;
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
			currentIndex.value =
				(currentIndex.value - 1 + playlist.value.length) %
				playlist.value.length;
		}
		loadAndPlay();
	}

	function seek(time) {
		if (audioElement) audioElement.currentTime = time;
	}

	function setVolume(val) {
		volume.value = val;
	}

	function cyclePlayMode() {
		playMode.value = (playMode.value + 1) % 3;
	}

	// ── 桌面歌词时间同步节流 ──
	let lastSentTime = -1;
	const DESKTOP_LYRICS_TIME_THROTTLE = 0.15; // 150ms 节流

	function updateTime(time) {
		currentTime.value = time;
		// 节流：仅在时间差超过阈值时才发送
		if (Math.abs(time - lastSentTime) >= DESKTOP_LYRICS_TIME_THROTTLE) {
			lastSentTime = time;
			sendDesktopLyricsTime();
		}
	}

	function setDuration(val) {
		duration.value = val;
	}

	function onEnded() {
		if (playMode.value === 2) {
			seek(0);
			audioElement?.play();
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

function extractKeyword(title) {
	if (!title) return '';
	const patterns = [/《(.+?)》/, /【(.+?)】/, /「(.+?)」/, /"(.+?)"/];
	for (const p of patterns) {
		const m = title.match(p);
		if (m) return m[1].trim();
	}
	return title.trim();
}

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
	} catch {}
}
