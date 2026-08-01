/**
 * 播放队列状态 — 管理当前索引、曲目增删和播放选择
 */

import { computed, ref } from 'vue';

export function usePlayerQueue({ initialPlaylist, onLoad, onClear, onSave }) {
  const playlist = ref(initialPlaylist);
  const currentIndex = ref(-1);

  const currentTrack = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
      return playlist.value[currentIndex.value];
    }
    return null;
  });

  function playTrack(track) {
    const index = playlist.value.findIndex((item) => item.bvid === track.bvid);
    if (index >= 0) {
      currentIndex.value = index;
    } else {
      playlist.value.push(track);
      currentIndex.value = playlist.value.length - 1;
    }
    onLoad();
  }

  function addToPlaylist(track) {
    if (playlist.value.some((item) => item.bvid === track.bvid)) return;
    playlist.value.push(track);
    onSave(playlist.value);
  }

  function playAtIndex(index) {
    if (index < 0 || index >= playlist.value.length) return;
    currentIndex.value = index;
    onLoad();
  }

  function removeFromPlaylist(index) {
    playlist.value.splice(index, 1);
    onSave(playlist.value);
    if (currentIndex.value === index) {
      if (playlist.value.length > 0) {
        currentIndex.value = Math.min(index, playlist.value.length - 1);
        onLoad();
      } else {
        onClear();
        currentIndex.value = -1;
      }
    } else if (currentIndex.value > index) {
      currentIndex.value--;
    }
  }

  function clearPlaylist() {
    onClear();
    playlist.value = [];
    currentIndex.value = -1;
    onSave([]);
  }

  return {
    playlist,
    currentIndex,
    currentTrack,
    playTrack,
    addToPlaylist,
    playAtIndex,
    removeFromPlaylist,
    clearPlaylist,
  };
}
