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
        <div
          v-for="item in results"
          :key="item.bvid"
          class="result-card"
          @click="player.playTrack(item)"
        >
          <div class="card-cover">
            <img :src="item.cover + '@672w_420h.webp'" :alt="item.title" loading="lazy" />
            <div class="card-overlay">
              <Icon icon="mdi:play-circle-outline" class="play-icon" />
            </div>
            <span class="card-duration">{{ formatDuration(item.duration) }}</span>
          </div>
          <div class="card-info">
            <h4 class="card-title" :title="item.title">{{ item.title }}</h4>
            <p class="card-author">
              <Icon icon="mdi:account-outline" class="meta-icon" />
              {{ item.author }}
            </p>
            <p class="card-stats">
              <Icon icon="mdi:play-circle-outline" class="meta-icon" />
              {{ formatNumber(item.play) }}
            </p>
          </div>
          <div class="card-actions">
            <TooltipRoot>
              <TooltipTrigger as-child>
                <button
                  class="add-btn"
                  @click.stop="player.addToPlaylist(item)"
                >
                  <Icon icon="mdi:plus" />
                </button>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                  添加到播放列表
                  <TooltipArrow class="tooltip-arrow" />
                </TooltipContent>
              </TooltipPortal>
            </TooltipRoot>
            <TooltipRoot v-if="user.loggedIn && user.favFolderId">
              <TooltipTrigger as-child>
                <button
                  class="fav-btn"
                  :class="{ favorited: user.isFavorited(item.bvid) }"
                  @click.stop="user.toggleFav(item)"
                >
                  <Icon :icon="user.isFavorited(item.bvid) ? 'mdi:heart' : 'mdi:heart-outline'" />
                </button>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                  {{ user.isFavorited(item.bvid) ? '取消收藏' : '收藏到「' + user.favFolderName + '」' }}
                  <TooltipArrow class="tooltip-arrow" />
                </TooltipContent>
              </TooltipPortal>
            </TooltipRoot>
          </div>
        </div>
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
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import { Icon } from '@iconify/vue'
import {
  TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow,
  TooltipProvider
} from 'reka-ui'

export default {
  name: 'SearchView',
  components: {
    Icon,
    TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow,
    TooltipProvider
  },
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
    const user = useUserStore()
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

    function formatDuration(duration) {
      if (!duration) return '--:--'
      // B站API可能返回 "3:45" 格式字符串或秒数
      if (typeof duration === 'string' && duration.includes(':')) return duration
      const m = Math.floor(duration / 60)
      const s = duration % 60
      return `${m}:${String(s).padStart(2, '0')}`
    }

    function formatNumber(num) {
      if (!num) return '0'
      return num >= 10000 ? (num / 10000).toFixed(1) + '万' : String(num)
    }

    return { results, loading, error, page, total, totalPages, player, user, doSearch, goToPage, formatDuration, formatNumber }
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

.result-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
  border: 1px solid var(--border);
}

.result-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px var(--shadow);
  border-color: var(--accent-dim);
}

.card-cover {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.result-card:hover .card-cover img {
  transform: scale(1.08);
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition);
}

.result-card:hover .card-overlay {
  opacity: 1;
}

.play-icon {
  font-size: 40px;
  color: white;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
}

.card-duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.card-info {
  padding: 12px;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-author,
.card-stats {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition);
}

.result-card:hover .card-actions {
  opacity: 1;
}

.add-btn,
.fav-btn {
  background: rgba(0, 0, 0, 0.65);
  color: white;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  backdrop-filter: blur(4px);
}

.add-btn:hover,
.fav-btn:hover {
  background: var(--accent);
  color: var(--bg-deep);
}

.fav-btn.favorited {
  background: var(--accent);
  color: #fff;
}

.fav-btn.favorited:hover {
  background: rgba(0, 0, 0, 0.65);
  color: var(--accent);
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
