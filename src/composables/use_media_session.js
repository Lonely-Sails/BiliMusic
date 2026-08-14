/**
 * 系统媒体会话 — 接入 navigator.mediaSession
 *
 * 在 macOS 锁屏/控制中心、Windows SMTC（系统媒体传输控制）显示正在播放信息，
 * 并响应系统级播放控制（播放/暂停/上一曲/下一曲/拖动进度）。
 * 配合主进程 globalShortcut 的硬件媒体键，构成完整的系统媒体控制链路。
 */

import { watch } from 'vue';
import { usePlayerStore } from '../stores/player';

export function useMediaSession() {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

  const player = usePlayerStore();

  function bindAction(action, handler) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // 当前平台不支持该动作时忽略（如部分 Linux 桌面环境）
    }
  }

  function updateMetadata(track) {
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const artwork = track.cover ? [{ src: track.cover, sizes: '512x512' }] : [];
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: track.title || '未知曲目',
      artist: track.author || 'Bilibili',
      album: 'BiliMusic',
      artwork,
    });
  }

  function updatePlaybackState() {
    navigator.mediaSession.playbackState = player.isPlaying ? 'playing' : 'paused';
  }

  // ── 监听 ──
  // 注意：pinia store 代理会自动解包 ref/computed，直接取值即可（不可再 .value）
  watch(() => player.currentTrack, updateMetadata, { immediate: true });
  watch(() => player.isPlaying, updatePlaybackState, { immediate: true });

  bindAction('play', () => {
    if (!player.isPlaying) player.togglePlay();
  });
  bindAction('pause', () => {
    if (player.isPlaying) player.togglePlay();
  });
  bindAction('nexttrack', () => player.nextTrack());
  bindAction('previoustrack', () => player.prevTrack());
  bindAction('seekto', (details) => {
    if (details?.seekTime != null) player.seek(details.seekTime);
  });
}
