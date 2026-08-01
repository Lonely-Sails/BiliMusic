<template>
  <TooltipProvider>
    <div class="collection-view">
      <!-- 合集头部信息 -->
      <div v-if="meta" class="collection-header">
        <div class="collection-cover">
          <img :src="meta.cover" :alt="meta.name" />
        </div>
        <div class="collection-info">
          <span class="collection-label"> <Icon icon="mdi:layers-outline" /> 视频合集 </span>
          <h2 class="collection-name">{{ meta.name }}</h2>
          <p v-if="meta.description" class="collection-desc">{{ meta.description }}</p>
          <div class="collection-meta">
            <span><Icon icon="mdi:video-outline" class="meta-icon" /> {{ meta.total }} 个视频</span>
          </div>
          <div v-if="archives.length" class="collection-actions">
            <button class="play-all-btn" @click="playAll"><Icon icon="mdi:play" /> 播放全部</button>
            <button class="add-all-btn" @click="addAll">
              <Icon icon="mdi:playlist-plus" /> 添加全部
            </button>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner" />
        <span>加载中...</span>
      </div>
      <div v-else-if="loadError" class="error-state">
        <Icon icon="mdi:alert-circle-outline" class="error-icon" />
        <p>{{ loadError }}</p>
        <button class="retry-btn" @click="loadArchives">重试</button>
      </div>
      <div v-else-if="!archives.length" class="empty-state">
        <Icon icon="mdi:layers-off-outline" class="empty-icon" />
        <p>合集暂无内容</p>
      </div>

      <!-- 合集视频列表 -->
      <div v-else class="collection-content">
        <div class="results-grid">
          <SongCard v-for="item in archives" :key="item.bvid" :item="item" />
        </div>
        <div v-if="totalPages > 1" class="pagination">
          <button :disabled="page <= 1" class="page-btn" @click="goToPage(page - 1)">
            <Icon icon="mdi:chevron-left" />上一页
          </button>
          <span class="page-info">{{ page }} / {{ totalPages }}</span>
          <button :disabled="page >= totalPages" class="page-btn" @click="goToPage(page + 1)">
            下一页
            <Icon icon="mdi:chevron-right" />
          </button>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<script setup>
/**
 * CollectionView.vue — 视频合集页
 *
 * 通过路由 query 参数 mid / seasonId 获取合集信息，
 * 展示合集元数据 + 视频列表，支持分页、播放全部。
 */

import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePlayerStore } from '../stores/player';
import { Icon } from '@iconify/vue';
import SongCard from '../components/SongCard.vue';
import TooltipProvider from '../components/ui/TooltipProvider.vue';

const route = useRoute();
const player = usePlayerStore();

const meta = ref(null);
const archives = ref([]);
const loading = ref(false);
const loadError = ref('');
const page = ref(1);
const totalPages = ref(1);
const PAGE_SIZE = 30;

const mid = () => route.query.mid;
const seasonId = () => route.query.seasonId;

onMounted(() => {
  if (mid() && seasonId()) loadArchives();
});

// 路由参数变化时重新加载（从不同卡片进入不同合集）
watch(
  () => [route.query.mid, route.query.seasonId],
  ([m, s]) => {
    if (m && s) {
      page.value = 1;
      meta.value = null;
      archives.value = [];
      loadArchives();
    }
  }
);

/** 加载合集内容 */
async function loadArchives() {
  if (!mid() || !seasonId()) return;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await window.electronAPI.getSeasonArchives(
      mid(),
      seasonId(),
      page.value,
      PAGE_SIZE
    );
    if (result?.error) {
      loadError.value = result.error;
      return;
    }
    meta.value = result.meta;
    archives.value = result.archives || [];
    const total = result.page?.total || result.meta?.total || 0;
    totalPages.value = Math.ceil(total / PAGE_SIZE) || 1;
  } catch (e) {
    loadError.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

/** 翻页 */
async function goToPage(newPage) {
  if (newPage < 1 || newPage > totalPages.value) return;
  page.value = newPage;
  await loadArchives();
}

/** 播放全部 */
function playAll() {
  if (!archives.value.length) return;
  archives.value.forEach((item) => player.addToPlaylist(item));
  player.playTrack(archives.value[0]);
}

/** 添加全部到播放列表 */
function addAll() {
  archives.value.forEach((item) => player.addToPlaylist(item));
}
</script>

<style scoped>
.collection-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 28px 32px;
}

.collection-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.collection-cover {
  width: 180px;
  height: 180px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-tertiary);
  box-shadow: 0 8px 24px var(--shadow);
}

.collection-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.collection-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.collection-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.collection-name {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.collection-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collection-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

.collection-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-icon {
  font-size: 14px;
}

.collection-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.play-all-btn,
.add-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: var(--radius-xl);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.play-all-btn {
  background: var(--accent);
  color: var(--bg-deep);
  border: none;
  transition: background var(--transition);
}

.play-all-btn:hover {
  background: var(--accent-hover);
}

.add-all-btn {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  transition: all var(--transition);
}

.add-all-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
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

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  gap: 12px;
  color: var(--text-muted);
}

.loading-state .spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.error-icon,
.empty-icon {
  font-size: 40px;
}

.retry-btn {
  background: var(--accent);
  color: var(--bg-deep);
  border: none;
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
</style>
