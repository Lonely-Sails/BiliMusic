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

const STORAGE_KEYS = {
	playlist: 'bilimusic_playlist',
	volume: 'bilimusic_volume',
	playMode: 'bilimusic_playmode',
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

	/** <audio> 元素引用（由 App.vue 的 onMounted 设置） */
	let audioElement = null;

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
	//  playlist/volume/playMode/showTranslation 变化时自动写入 localStorage
	// ══════════════════════════════════════════

	watch(playlist, (val) => saveToStorage(STORAGE_KEYS.playlist, val), {
		deep: true,
	});
	watch(volume, (val) => {
		saveToStorage(STORAGE_KEYS.volume, val);
		if (audioElement) audioElement.volume = val;
	});
	watch(playMode, (val) => saveToStorage(STORAGE_KEYS.playMode, val));
	watch(showTranslation, (val) =>
		saveToStorage('bilimusic_show_translation', val),
	);

	// 曲目/歌词变化 → 同步到桌面歌词窗口
	watch(currentTrack, () => sendDesktopLyricsTrack());
	watch(currentLyrics, () => sendDesktopLyricsUpdate(), { deep: true });

	// --- Actions ---
	function setAudioElement(el) {
		audioElement = el;
		if (audioElement) audioElement.volume = volume.value;
	}

	function playTrack(track) {
		// 先清空当前状态，再切换歌曲
		clearCurrentState();
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
		}
	}

	function playAtIndex(index) {
		if (index >= 0 && index < playlist.value.length) {
			clearCurrentState();
			currentIndex.value = index;
			loadAndPlay();
		}
	}

	function removeFromPlaylist(index) {
		playlist.value.splice(index, 1);
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
	}

	function toPlainObject(obj) {
		return JSON.parse(JSON.stringify(obj));
	}

	function sendDesktopLyricsUpdate() {
		if (!window.electronAPI?.desktopLyricsUpdateLyrics) return;
		window.electronAPI.desktopLyricsUpdateLyrics({
			lyrics: toPlainObject(currentLyrics.value),
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
		const track = currentTrack.value;
		if (!track || !audioElement) return;

		clearCurrentState();

		try {
			let cid = track.cid === '0' ? null : track.cid;
			// bvid 为空时也需要调用 getVideoInfo 拿到真实的 bvid
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

			// 缓存音频 URL
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
			if (audioData?.url) {
				const proxyUrl = 'bili://' + encodeURIComponent(audioData.url);
				audioElement.src = proxyUrl;
				await audioElement.play();
				isPlaying.value = true;
				loadLyrics(track.bvid, cid, track.title);
				sendDesktopLyricsTrack();
			}
		} catch (e) {
			console.error('[BiliMusic] Failed to load audio:', e);
		}
	}

	async function loadLyrics(bvid, cid, title) {
		try {
			// 后端 IPC 内部会：
			// 1. 获取视频信息（含 bgm_info）提取最佳搜索词
			// 2. 检查本地文件
			// 3. 获取 B 站 AI 字幕
			// 4. 按相似度排序在线搜索
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
			if (source === 'subtitle') {
				const track = currentTrack.value;
				if (track?.bvid) {
					const result = await window.electronAPI.getLyric(
						track.bvid,
						track.cid || '',
						track.title,
					);
					if (result?.lyrics) {
						currentLyrics.value = result.lyrics;
						lyricSource.value = result.source;
						lyricCandidateId.value = id;
						sendDesktopLyricsUpdate();
						return;
					}
				}
			}
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

	function updateTime(time) {
		currentTime.value = time;
		sendDesktopLyricsTime();
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
		currentTrack,
		audioElement,
		setAudioElement,
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
