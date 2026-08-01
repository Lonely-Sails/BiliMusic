/**
 * 首页状态管理 — 热歌榜、热门推荐与新歌数据
 *
 * 职责：通过 IPC 加载首页数据，并惰性补齐歌曲时长
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useHomeStore = defineStore('home', () => {
  // ── 状态 ──
  const loading = ref(true);
  const error = ref('');
  const toplist = ref([]);
  const hotRank = ref([]);
  const newMusic = ref([]);
  const durationCache = new Map();

  // ── 方法 ──
  async function safeCall(request) {
    try {
      const result = await request();
      if (result?.error) {
        console.warn('[BiliMusic] API:', result.error);
        return null;
      }
      return result;
    } catch (requestError) {
      console.warn('[BiliMusic] API error:', requestError);
      return null;
    }
  }

  async function fetchMissingDuration(item) {
    if (!item.bvid || item.duration > 0) return;
    if (durationCache.has(item.bvid)) {
      item.duration = durationCache.get(item.bvid);
      return;
    }
    try {
      const info = await window.electronAPI.getVideoInfo(item.bvid, item.aid || 0);
      if (info?.duration) {
        item.duration = info.duration;
        durationCache.set(item.bvid, info.duration);
      }
    } catch {
      // Duration is optional; playback resolves track data again when needed.
    }
  }

  async function loadAll() {
    loading.value = true;
    error.value = '';
    await safeCall(() => window.electronAPI.ensureSession());
    try {
      const [toplistData, hotRankData, newMusicData] = await Promise.all([
        safeCall(() => window.electronAPI.getHotToplist()),
        safeCall(() => window.electronAPI.getHotRank()),
        safeCall(() => window.electronAPI.getNewMusic()),
      ]);

      if (toplistData?.list) toplist.value = toplistData.list;
      if (hotRankData?.list) hotRank.value = hotRankData.list.slice(0, 20);
      if (newMusicData?.list) newMusic.value = newMusicData.list.slice(0, 12);

      for (const item of [...hotRank.value, ...newMusic.value]) {
        if (!item.duration) fetchMissingDuration(item);
      }
      if (!toplistData && !hotRankData && !newMusicData) {
        error.value = '暂时无法获取音乐数据';
      }
    } catch (loadError) {
      error.value = `加载失败: ${loadError.message}`;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, toplist, hotRank, newMusic, loadAll };
});
