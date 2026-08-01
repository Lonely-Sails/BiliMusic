/**
 * 搜索状态管理 — 搜索建议与热搜数据
 *
 * 职责：通过 IPC 获取搜索辅助数据，并维护渲染层搜索状态
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSearchStore = defineStore('search', () => {
  // ── 状态 ──
  const suggestions = ref([]);
  const hotSearch = ref([]);

  // ── 方法 ──
  async function fetchHotSearch() {
    try {
      const result = await window.electronAPI.getHotSearch();
      if (Array.isArray(result)) {
        hotSearch.value = result;
      } else if (result?.error) {
        console.error('[BiliMusic] Hot search error:', result.error);
      }
    } catch (error) {
      console.error('[BiliMusic] Failed to fetch hot search:', error);
    }
  }

  async function fetchSuggestions(term) {
    try {
      const result = await window.electronAPI.getSearchSuggest(term);
      suggestions.value = Array.isArray(result) ? result : [];
    } catch {
      suggestions.value = [];
    }
  }

  function clearSuggestions() {
    suggestions.value = [];
  }

  return {
    suggestions,
    hotSearch,
    fetchHotSearch,
    fetchSuggestions,
    clearSuggestions,
  };
});
