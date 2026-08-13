<template>
  <div class="app-container">
    <AppHeader
      v-model:search-query="searchQuery"
      v-model:search-open="showDropdown"
      :is-mac="isMac"
      :is-maximized="isMaxed"
      :autocomplete-groups="autocompleteGroups"
      @search-input="onInput"
      @search="doSearch"
      @select-suggestion="selectSuggestion"
      @clear-history="clearHistory"
      @minimize="minimizeWindow"
      @maximize="maximizeWindow"
      @close="closeWindow"
    />

    <div class="app-body">
      <AppSidebar
        :can-go-back="canGoBack"
        :playlist-count="player.playlist.length"
        @go-back="goBack"
      />

      <main class="main-content">
        <router-view :key="$route.name" />
      </main>
    </div>

    <PlayerBar />

    <KeepAlive>
      <LyricsOverlay :visible="showLyricsOverlay" @close="showLyricsOverlay = false" />
    </KeepAlive>

    <audio
      ref="audioRef"
      crossorigin="anonymous"
      preload="auto"
      @timeupdate="onTimeUpdate($event.target.currentTime)"
      @ended="player.onEnded()"
      @loadedmetadata="player.setDuration($event.target.duration)"
      @error="player.isPlaying = false"
    />

    <ToastProvider>
      <Toast
        v-for="toast in toasts"
        :key="toast.id"
        :message="toast.message"
        :type="toast.type"
        :on-close="() => removeToast(toast.id)"
      />
    </ToastProvider>
  </div>
</template>

<script setup>
/**
 * App.vue — 应用根组件
 *
 * 布局：
 * ┌──────────────────────────────────────┐
 * │ Header: 窗口控制 | Logo | 搜索 | 登录 │
 * ├────────┬─────────────────────────────┤
 * │ Sidebar│  Main (router)             │
 * ├────────┴─────────────────────────────┤
 * │ PlayerBar                            │
 * └──────────────────────────────────────┘
 *
 * 额外：歌词弹层 (LyricsOverlay)、Toast 通知
 */

import { ref, computed, watch, onMounted, provide, defineAsyncComponent } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { usePlayerStore } from './stores/player';
import { useToast } from './stores/toast';
import { useSearch } from './composables/use_search';
import PlayerBar from './components/PlayerBar.vue';
import AppHeader from './components/AppHeader.vue';
import AppSidebar from './components/AppSidebar.vue';
import ToastProvider from './components/ui/ToastProvider.vue';
import Toast from './components/ui/Toast.vue';

// ── 常量 ──
const isMac = navigator.platform.startsWith('Mac'); // 编译时确定，无需响应式

// ── 异步组件（懒加载） ──
const LyricsOverlay = defineAsyncComponent(() => import('./components/LyricsOverlay.vue'));

// ── Store / Router ──
const router = useRouter();
const route = useRoute();
const player = usePlayerStore();
const { toasts } = useToast();

function removeToast(id) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

// ── 响应式状态 ──
const audioRef = ref(null); // <audio> 元素引用
const searchKey = ref(0); // 强制重搜时递增
const showLyricsOverlay = ref(false); // 歌词弹层可见性
const {
  searchQuery,
  showDropdown,
  autocompleteGroups,
  loadHistory,
  clearHistory,
  onInput,
  selectSuggestion,
  doSearch,
} = useSearch(router, searchKey);

// 向下提供（给子组件使用）
provide('searchKey', searchKey);
provide('toggleLyricsOverlay', () => {
  showLyricsOverlay.value = !showLyricsOverlay.value;
});

// 窗口相关
const isMaxed = ref(false); // 窗口是否最大化

// ── 窗口控制 ──
function minimizeWindow() {
  window.electronAPI?.minimizeWindow();
}
function maximizeWindow() {
  window.electronAPI?.maximizeWindow();
}
function closeWindow() {
  window.electronAPI?.closeWindow();
}

/** 侧边栏返回按钮 — 跟踪路由深度，无历史时置灰 */
const historyDepth = ref(0);
const canGoBack = computed(() => historyDepth.value > 0);
let isBackNav = false;
watch(
  () => route.fullPath,
  () => {
    if (isBackNav) {
      isBackNav = false;
      return;
    }
    historyDepth.value++;
  }
);

function goBack() {
  if (!historyDepth.value) return;
  isBackNav = true;
  historyDepth.value--;
  router.back();
}

// ── 时间更新节流（降低渲染开销） ──
// 用时间戳节流而非 rAF：窗口失焦时 Chromium 会暂停 rAF，导致桌面歌词同步卡死。
// timeupdate 事件约 4 次/秒，足够桌面歌词与进度条使用。
let lastUiTime = 0;
function onTimeUpdate(time) {
  const now = performance.now();
  if (now - lastUiTime < 50) return; // 最多 ~20 次/秒
  lastUiTime = now;
  player.updateTime(time);
}

// ── 生命周期 ──
onMounted(() => {
  // 关联 <audio> 元素到 player store
  if (audioRef.value) player.setAudioElement(audioRef.value);

  // 歌词编辑器保存后自动刷新歌词
  if (window.electronAPI?.onLyricsEditorSaved) {
    window.electronAPI.onLyricsEditorSaved(() => {
      const track = player.currentTrack.value;
      if (track?.bvid) player.loadLyrics(track.bvid, track.cid || '', track.title);
    });
  }

  loadHistory();

  // 窗口最大化状态同步
  window.electronAPI?.isMaximized().then((v) => (isMaxed.value = v));
  window.electronAPI?.onMaximizeChange((v) => (isMaxed.value = v));
  window.electronAPI?.ensureSession().catch((e) => console.warn('[BiliMusic] Session init:', e));
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: transparent;
}
</style>
