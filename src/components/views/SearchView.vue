<template>
  <TooltipProvider>
  <div class="search-view">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>正在搜索...</span>
    </div>

    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle-outline" class="error-icon" />
      <p>{{ error }}</p>
      <button @click="doSearch" class="retry-btn">重试</button>
    </div>

    <div v-else-if="results.length > 0" class="search-results">
      <div class="results-header">
        <span class="results-count">共 {{ total }} 个结果</span>
      </div>
      <div class="results-grid">
        <SongCard v-for="item in results" :key="item.bvid" :item="item" />
      </div>

      <div v-if="totalPages > 1" class="pagination">
        <button :disabled="page <= 1" @click="goToPage(page - 1)" class="page-btn">
          <Icon icon="mdi:chevron-left" /> 上一页
        </button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages" @click="goToPage(page + 1)" class="page-btn">
          下一页 <Icon icon="mdi:chevron-right" />
        </button>
      </div>
    </div>

    <div v-else class="empty-state">
      <Icon icon="mdi:music-note-off" class="empty-icon" />
      <p class="empty-title">搜索你想听的音乐</p>
      <p class="empty-hint">输入关键词搜索B站视频</p>
    </div>

  </div>
  </TooltipProvider>
</template>

<script>
import { ref, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { usePlayerStore } from '../../stores/player'
import { Icon } from '@iconify/vue'
import SongCard from '../SongCard.vue'

export default {
  name: 'SearchView',
  components: { Icon, SongCard },
  setup() {
    const route = useRoute()
    const results = ref([])
    const loading = ref(false)
    const error = ref('')
    const keyword = ref('')
    const page = ref(1)
    const total = ref(0)
    const totalPages = ref(0)
    const player = usePlayerStore()
    const searchKey = inject('searchKey', ref(0))

    watch(() => route.query.q, (q) => {
      results.value = []
      error.value = ''
      if (q && q.trim()) {
        keyword.value = q.trim()
        doSearch()
      }
    }, { immediate: true })

    // 相同关键词重搜时触发
    watch(searchKey, () => {
      if (keyword.value) {
        results.value = []
        error.value = ''
        doSearch()
      }
    })

    async function doSearch() {
      if (!keyword.value) return
      loading.value = true
      error.value = ''
      page.value = 1

      try {
        const result = await window.electronAPI.searchVideo(keyword.value, page.value)
        if (result.error) {
          error.value = result.error
          results.value = []
        } else {
          results.value = result.videos || []
          total.value = result.total || 0
          totalPages.value = result.totalPages || 1
        }
      } catch (e) {
        error.value = '搜索失败: ' + e.message
        results.value = []
      } finally {
        loading.value = false
      }
    }

    async function goToPage(newPage) {
      if (newPage < 1 || newPage > totalPages.value) return
      page.value = newPage
      loading.value = true
      try {
        const result = await window.electronAPI.searchVideo(keyword.value, page.value)
        results.value = result.error ? [] : (result.videos || [])
      } catch { /* ignore */ }
      loading.value = false
    }

    return { results, loading, error, page, total, totalPages, player, doSearch, goToPage }
  }
}
</script>

<style scoped>
.search-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 28px 32px;
}

.results-header {
  margin-bottom: 4px;
}

.results-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
}

.page-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  transition: all var(--transition);
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
