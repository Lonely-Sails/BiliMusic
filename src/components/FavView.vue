<template>
  <TooltipProvider>
  <div class="fav-view">
    <div class="fav-header">
      <h2>
        <Icon icon="mdi:star-outline" class="section-icon" />
        收藏夹
      </h2>
      <div class="fav-header-actions" v-if="resources.length > 0">
        <span class="fav-count">{{ total }} 首</span>
        <TooltipRoot>
          <TooltipTrigger as-child>
            <button class="play-all-btn" @click="playAll">
              <Icon icon="mdi:playlist-plus" /> 一键播放
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
              将当前页全部添加到播放列表
              <TooltipArrow class="tooltip-arrow" />
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </div>
    </div>

    <!-- 未登录 -->
    <div v-if="!user.loggedIn" class="fav-login-hint">
      <Icon icon="mdi:account-lock" class="empty-icon" />
      <p>请先登录B站账号查看收藏夹</p>
    </div>

    <!-- 已登录但未设置收藏夹 -->
    <div v-else-if="!user.favFolderId" class="fav-no-folder">
      <Icon icon="mdi:folder-cog-outline" class="empty-icon" />
      <p class="empty-title">尚未设置收藏夹</p>
      <p class="empty-hint">请先在设置中选择歌曲收藏夹</p>
      <router-link to="/settings" class="goto-settings-btn">
        <Icon icon="mdi:cog-outline" /> 前往设置
      </router-link>
    </div>

    <!-- 已设置收藏夹 - 加载中 -->
    <div v-else-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 已设置收藏夹 - 加载失败 -->
    <div v-else-if="loadError" class="error-state">
      <Icon icon="mdi:alert-circle-outline" class="error-icon" />
      <p>{{ loadError }}</p>
      <button @click="loadResources" class="retry-btn">重试</button>
    </div>

    <!-- 已设置收藏夹 - 内容为空 -->
    <div v-else-if="resources.length === 0" class="empty-state">
      <Icon icon="mdi:star-outline" class="empty-icon" />
      <p>收藏夹「{{ user.favFolderName }}」为空</p>
    </div>

    <!-- 已设置收藏夹 - 显示内容 -->
    <div v-else class="fav-content">
      <div class="fav-list">
        <div
          v-for="item in resources"
          :key="item.bvid"
          class="fav-list-item"
          @click="player.playTrack(item)"
        >
          <Icon icon="mdi:music-note" class="list-item-icon" />
          <div class="list-item-info">
            <span class="list-item-title" :title="item.title">{{ item.title }}</span>
            <span class="list-item-meta">
              <Icon icon="mdi:account-outline" class="meta-icon" />
              {{ item.author }}
              <Icon icon="mdi:clock-outline" class="meta-icon" style="margin-left:8px" />
              {{ formatDuration(item.duration) }}
            </span>
          </div>
          <div class="list-item-actions">
            <TooltipRoot>
              <TooltipTrigger as-child>
                <button class="list-add-btn" @click.stop="player.addToPlaylist(item)">
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
            <TooltipRoot>
              <TooltipTrigger as-child>
                <button class="list-del-btn" @click.stop="removeFav(item)">
                  <Icon icon="mdi:heart-off-outline" />
                </button>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                  取消收藏
                  <TooltipArrow class="tooltip-arrow" />
                </TooltipContent>
              </TooltipPortal>
            </TooltipRoot>
          </div>
        </div>
      </div>

      <!-- 分页 -->
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
  </div>
  </TooltipProvider>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { useUserStore } from '../stores/user'
import { usePlayerStore } from '../stores/player'
import { Icon } from '@iconify/vue'
import {
  TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow,
  TooltipProvider
} from 'reka-ui'

export default {
  name: 'FavView',
  components: {
    Icon,
    TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow,
    TooltipProvider
  },
  setup() {
    const user = useUserStore()
    const player = usePlayerStore()
    const resources = ref([])
    const loading = ref(false)
    const loadError = ref('')
    const page = ref(1)
    const total = ref(0)
    const totalPages = ref(0)
    const PAGE_SIZE = 20

    // 登录或收藏夹设置变化时自动加载
    watch(() => user.favFolderId, (val) => {
      if (val && user.loggedIn) {
        page.value = 1
        loadResources()
      }
    })

    onMounted(() => {
      if (user.loggedIn && user.favFolderId) {
        loadResources()
      }
    })

    async function loadResources() {
      if (!user.loggedIn || !user.favFolderId) return
      loading.value = true
      loadError.value = ''
      try {
        const result = await window.electronAPI.listFavResources(user.favFolderId, page.value, PAGE_SIZE)
        if (result && !result.error) {
          resources.value = result.resources || []
          total.value = result.total || 0
          totalPages.value = Math.ceil(total.value / PAGE_SIZE) || 1
          // 同步到 favoritedBvids set
          if (page.value === 1) {
            user.syncFavoritedBvids(resources.value)
          }
        } else {
          loadError.value = result?.error || '加载收藏内容失败'
          resources.value = []
        }
      } catch (e) {
        loadError.value = e.message || '加载收藏内容失败'
        resources.value = []
      } finally {
        loading.value = false
      }
    }

    async function goToPage(newPage) {
      if (newPage < 1 || newPage > totalPages.value) return
      page.value = newPage
      await loadResources()
    }

    function formatDuration(duration) {
      if (!duration) return '--:--'
      if (typeof duration === 'string' && duration.includes(':')) return duration
      const m = Math.floor(duration / 60)
      const s = duration % 60
      return `${m}:${String(s).padStart(2, '0')}`
    }

    async function removeFav(item) {
      const result = await user.toggleFav(item)
      if (result?.success && result.action === 'removed') {
        resources.value = resources.value.filter(r => r.bvid !== item.bvid)
        total.value = Math.max(0, total.value - 1)
        totalPages.value = Math.ceil(total.value / PAGE_SIZE) || 1
      }
    }

    function playAll() {
      const items = resources.value
      if (items.length === 0) return
      items.forEach(item => player.addToPlaylist(item))
      player.playTrack(items[0])
    }

    return { user, player, resources, loading, loadError, page, total, totalPages, loadResources, goToPage, formatDuration, removeFav, playAll }
  }
}
</script>

<style scoped>
.fav-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px 32px;
}

.fav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fav-header h2 {
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
}

.fav-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fav-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.play-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: var(--bg-deep);
  border: none;
  padding: 8px 18px;
  border-radius: var(--radius-xl);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition);
}

.play-all-btn:hover {
  background: var(--accent-hover);
}

.fav-login-hint,
.fav-no-folder {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.goto-settings-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  background: var(--accent);
  color: var(--bg-deep);
  border: none;
  padding: 10px 24px;
  border-radius: var(--radius-xl);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition);
  text-decoration: none;
}

.goto-settings-btn:hover {
  background: var(--accent-hover);
}

/* ===== List layout ===== */
.fav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fav-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition);
}

.fav-list-item:hover {
  background: var(--bg-hover);
  border-color: var(--accent-dim);
}

.list-item-icon {
  font-size: 22px;
  color: var(--accent);
  flex-shrink: 0;
}

.list-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-item-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-item-meta {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

.list-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.list-add-btn,
.list-del-btn {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  flex-shrink: 0;
}

.list-add-btn:hover {
  background: var(--accent);
  color: var(--bg-deep);
  border-color: var(--accent);
}

.list-del-btn:hover {
  background: var(--danger);
  color: #fff;
  border-color: var(--danger);
}

/* ===== Pagination ===== */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.page-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all var(--transition);
  font-family: inherit;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent-dim);
  background: var(--bg-hover);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: var(--text-muted);
}
</style>
