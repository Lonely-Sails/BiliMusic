<template>
  <TooltipProvider>
    <div class="up-view">
      <!-- UP主头部信息 -->
      <div v-if="userInfo" class="up-header">
        <div class="up-avatar">
          <img :src="userInfo.face" :alt="userInfo.name" />
        </div>
        <div class="up-info">
          <div class="up-name-row">
            <h2 class="up-name">{{ userInfo.name }}</h2>
            <Icon v-if="userInfo.vip?.status" icon="mdi:crown" class="up-vip" />
          </div>
          <p v-if="userInfo.sign" class="up-sign">{{ userInfo.sign }}</p>
          <div class="up-meta">
            <span
              ><Icon icon="mdi:account-check-outline" class="meta-icon" /> 关注
              {{ formatNumber(relation.following) }}</span
            >
            <span
              ><Icon icon="mdi:account-multiple-outline" class="meta-icon" /> 粉丝
              {{ formatNumber(relation.follower) }}</span
            >
            <span><Icon icon="mdi:video-outline" class="meta-icon" /> {{ total }} 个视频</span>
          </div>
          <div v-if="archives.length" class="up-actions">
            <button class="play-all-btn" @click="playAll"><Icon icon="mdi:play" /> 播放全部</button>
            <button class="add-all-btn" @click="addAll">
              <Icon icon="mdi:playlist-plus" /> 添加全部
            </button>
          </div>
          <!-- 搜索框 -->
          <div class="search-bar">
            <Icon icon="mdi:magnify" class="search-bar-icon" />
            <input
              v-model="keyword"
              type="text"
              class="search-input"
              placeholder="搜索该UP主的视频..."
              @keyup.enter="onSearch"
            />
            <button v-if="keyword" class="search-clear" @click="clearSearch">
              <Icon icon="mdi:close-circle" />
            </button>
            <span class="result-count">{{ archives.length }} / {{ total }} 个视频</span>
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
        <button class="retry-btn" @click="loadAll">重试</button>
      </div>
      <div v-else-if="!archives.length" class="empty-state">
        <Icon icon="mdi:magnify-close" class="empty-icon" />
        <p>{{ keyword ? '未找到相关视频' : '该UP主暂无投稿' }}</p>
      </div>

      <!-- UP主视频列表 -->
      <div v-else class="up-content">
        <div class="results-grid">
          <SongCard v-for="item in archives" :key="item.bvid" :item="item" :show-author="false" />
        </div>
        <div v-if="totalPages > 1" class="pagination-wrap">
          <Pagination :page="page" :total="total" :page-size="PAGE_SIZE" @update:page="goToPage" />
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<script setup>
/**
 * UpView.vue — UP主（用户）页面
 *
 * 通过路由 query 参数 mid 获取UP主信息与投稿列表，
 * 展示UP主头像、简介、关注/粉丝数 + 视频列表，支持分页、播放全部。
 */

import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePlayerStore } from '../stores/player';
import { Icon } from '@iconify/vue';
import SongCard from '../components/SongCard.vue';
import TooltipProvider from '../components/ui/TooltipProvider.vue';
import Pagination from '../components/ui/Pagination.vue';

const route = useRoute();
const player = usePlayerStore();

const userInfo = ref(null);
const relation = ref({ following: 0, follower: 0 });
const archives = ref([]);
const total = ref(0);
const loading = ref(false);
const loadError = ref('');
const page = ref(1);
const totalPages = ref(1);
const keyword = ref('');
const PAGE_SIZE = 30;

const mid = () => route.query.mid;

onMounted(() => {
  if (mid()) loadAll();
});

// 路由参数变化时重新加载（从不同卡片进入不同UP主）
watch(
  () => route.query.mid,
  (m) => {
    if (m) {
      page.value = 1;
      keyword.value = '';
      userInfo.value = null;
      relation.value = { following: 0, follower: 0 };
      archives.value = [];
      total.value = 0;
      loadAll();
    }
  }
);

/** 加载UP主信息 + 投稿列表 */
async function loadAll() {
  if (!mid()) return;
  loading.value = true;
  loadError.value = '';
  try {
    const [infoResult, statResult, archiveResult] = await Promise.all([
      window.electronAPI.getUserInfo(mid()),
      window.electronAPI.getUserRelationStat(mid()),
      window.electronAPI.getUserArchives(mid(), page.value, PAGE_SIZE, keyword.value),
    ]);
    if (infoResult?.error) {
      loadError.value = infoResult.error;
      return;
    }
    userInfo.value = infoResult;
    if (statResult && !statResult.error) {
      relation.value = statResult;
    }
    if (archiveResult?.error) {
      loadError.value = archiveResult.error;
      return;
    }
    archives.value = archiveResult.archives || [];
    total.value = archiveResult.count || 0;
    totalPages.value = Math.ceil(total.value / PAGE_SIZE) || 1;
  } catch (e) {
    loadError.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

/** 按关键词搜索投稿 */
function onSearch() {
  page.value = 1;
  loadAll();
}

/** 清空搜索 */
function clearSearch() {
  keyword.value = '';
  onSearch();
}

/** 翻页 */
async function goToPage(newPage) {
  if (newPage < 1 || newPage > totalPages.value) return;
  page.value = newPage;
  await loadAll();
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

function formatNumber(num) {
  if (!num) return '0';
  return num >= 10000 ? (num / 10000).toFixed(1) + '万' : String(num);
}
</script>

<style scoped>
.up-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 28px 32px;
}

.up-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.up-avatar {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-tertiary);
  border: 3px solid var(--border);
  box-shadow: 0 8px 24px var(--shadow);
}

.up-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.up-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.up-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.up-name {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.up-vip {
  font-size: 18px;
  color: var(--accent);
}

.up-sign {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.up-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

.up-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-icon {
  font-size: 14px;
}

.up-actions {
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

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0 12px;
  max-width: 420px;
  width: 100%;
  margin-top: 8px;
  transition:
    border-color var(--transition),
    box-shadow var(--transition);
}

.search-bar:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.search-bar-icon {
  font-size: 18px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 10px 0;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color var(--transition);
  flex-shrink: 0;
}

.search-clear:hover {
  color: var(--text-primary);
}

.result-count {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}

.pagination-wrap {
  margin-top: 24px;
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
