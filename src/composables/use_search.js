/**
 * 搜索交互逻辑 — 输入建议、历史记录与路由跳转
 */

import { computed, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useSearchStore } from '../stores/search';

const HISTORY_KEY = 'bilimusic:search-history';
const LEGACY_HISTORY_KEY = 'bilimusic_search_history';
const MAX_HISTORY = 20;

export function useSearch(router, searchKey) {
  const searchStore = useSearchStore();
  const { suggestions, hotSearch } = storeToRefs(searchStore);
  const { fetchHotSearch, fetchSuggestions, clearSuggestions } = searchStore;
  const searchQuery = ref('');
  const showDropdown = ref(false);
  const history = ref([]);
  let suggestTimer;

  const autocompleteGroups = computed(() => {
    const groups = [];
    if (searchQuery.value && suggestions.value.length) {
      groups.push({
        label: '搜索建议',
        items: suggestions.value.map((suggestion) => ({
          value: suggestion.value,
          label: suggestion.name,
          icon: 'mdi:magnify',
        })),
      });
    }
    if (!searchQuery.value) {
      if (history.value.length) {
        groups.push({
          label: '搜索历史',
          clearable: true,
          items: history.value.map((keyword) => ({
            value: keyword,
            label: keyword,
            icon: 'mdi:history',
          })),
        });
      }
      if (hotSearch.value.length) {
        groups.push({
          label: 'B站热搜',
          items: hotSearch.value.map((item, index) => ({
            value: item.keyword,
            label: item.showName,
            rank: index + 1,
          })),
        });
      }
    }
    return groups;
  });

  function loadHistory() {
    try {
      const serializedHistory =
        localStorage.getItem(HISTORY_KEY) || localStorage.getItem(LEGACY_HISTORY_KEY) || '[]';
      const storedHistory = JSON.parse(serializedHistory);
      history.value = Array.isArray(storedHistory) ? storedHistory : [];
    } catch {
      history.value = [];
    }
  }

  function saveHistoryItem(keyword) {
    loadHistory();
    history.value = [keyword, ...history.value.filter((item) => item !== keyword)].slice(
      0,
      MAX_HISTORY
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value));
    localStorage.removeItem(LEGACY_HISTORY_KEY);
  }

  function clearHistory() {
    history.value = [];
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(LEGACY_HISTORY_KEY);
  }

  function onInput() {
    clearTimeout(suggestTimer);
    if (!searchQuery.value) {
      clearSuggestions();
      loadHistory();
      fetchHotSearch();
      return;
    }
    suggestTimer = setTimeout(() => fetchSuggestions(searchQuery.value), 200);
  }

  function selectSuggestion(value) {
    showDropdown.value = false;
    saveHistoryItem(value);
    router.push({ path: '/search', query: { q: value } }).catch(() => searchKey.value++);
  }

  async function doSearch() {
    const query = searchQuery.value.trim();
    if (!query) return;
    showDropdown.value = false;
    saveHistoryItem(query);
    try {
      await router.push({ path: '/search', query: { q: query } });
    } catch {
      searchKey.value++;
    }
  }

  onUnmounted(() => clearTimeout(suggestTimer));

  return {
    searchQuery,
    showDropdown,
    autocompleteGroups,
    loadHistory,
    clearHistory,
    onInput,
    selectSuggestion,
    doSearch,
  };
}
