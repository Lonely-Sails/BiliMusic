<template>
  <div class="app-container">
    <header class="app-header" :class="{ 'is-mac': isMac }">
      <div class="window-controls" v-if="!isMac">
        <button class="win-btn win-btn-minimize" @click="minimizeWindow" title="最小化">
          <Icon icon="mdi:window-minimize" />
        </button>
        <button class="win-btn win-btn-maximize" @click="maximizeWindow" :title="isMaxed ? '还原' : '最大化'">
          <Icon :icon="isMaxed ? 'mdi:window-restore' : 'mdi:window-maximize'" />
        </button>
        <button class="win-btn win-btn-close" @click="closeWindow" title="关闭">
          <Icon icon="mdi:close" />
        </button>
      </div>

      <div class="header-left drag-region">
        <div class="logo">
          <Icon icon="mdi:music-note" class="logo-icon" />
          <span class="logo-text">BiliMusic</span>
        </div>
      </div>

      <div class="drag-region header-center search-wrapper">
        <AutocompleteRoot class="autocomplete-root" v-model="searchQuery" v-model:open="showDropdown"
          :open-on-focus="true" :open-on-click="true" :ignore-filter="true" @update:model-value="onInput">
          <AutocompleteAnchor class="search-bar">
            <Icon icon="mdi:magnify" class="search-bar-icon" />
            <AutocompleteInput placeholder="搜索B站音乐..." class="search-input" @keyup.enter="doSearch" />
            <AutocompleteCancel v-if="searchQuery" as-child>
              <button class="search-clear">
                <Icon icon="mdi:close-circle" />
              </button>
            </AutocompleteCancel>
          </AutocompleteAnchor>

          <AutocompletePortal>
            <AutocompleteContent class="search-dropdown" position="popper" :side-offset="6" :hide-when-empty="false">
              <AutocompleteViewport class="sd-viewport">
                <AutocompleteGroup v-if="searchQuery && suggestions.length > 0">
                  <AutocompleteLabel class="sd-title">搜索建议</AutocompleteLabel>
                  <AutocompleteItem v-for="s in suggestions" :key="s.value" :value="s.value" class="sd-item"
                    @select="selectSuggestion(s.value)">
                    <Icon icon="mdi:magnify" class="sd-item-icon" />
                    <span>{{ s.name }}</span>
                  </AutocompleteItem>
                </AutocompleteGroup>

                <template v-if="!searchQuery">
                  <AutocompleteGroup v-if="history.length > 0">
                    <AutocompleteLabel class="sd-title sd-title-row">
                      <span>搜索历史</span>
                      <button class="sd-clear-btn" @click="clearHistory">清空</button>
                    </AutocompleteLabel>
                    <AutocompleteItem v-for="h in history" :key="h" :value="h" class="sd-item"
                      @select="selectSuggestion(h)">
                      <Icon icon="mdi:history" class="sd-item-icon" />
                      <span>{{ h }}</span>
                    </AutocompleteItem>
                  </AutocompleteGroup>

                  <AutocompleteGroup v-if="hotSearch.length > 0">
                    <AutocompleteLabel class="sd-title">B站热搜</AutocompleteLabel>
                    <AutocompleteItem v-for="(hot, i) in hotSearch" :key="'hot-' + i" :value="hot.keyword"
                      class="sd-item" @select="selectSuggestion(hot.keyword)">
                      <span class="sd-rank" :class="{
                        'sd-rank-top': i < 3,
                      }">{{ i + 1 }}</span>
                      <span class="sd-hot-text">{{ hot.showName }}</span>
                    </AutocompleteItem>
                  </AutocompleteGroup>
                </template>

                <AutocompleteEmpty class="sd-empty">暂无数据</AutocompleteEmpty>
              </AutocompleteViewport>
            </AutocompleteContent>
          </AutocompletePortal>
        </AutocompleteRoot>
      </div>

      <div class="header-right">
        <LoginPanel />
      </div>
    </header>

    <div class="app-body">
      <aside class="sidebar">
        <button class="nav-back" :disabled="!canGoBack" @click="goBack" title="返回">
          <Icon icon="mdi:chevron-left" />
        </button>
        <nav class="sidebar-nav">
          <router-link to="/home" class="nav-item" active-class="active">
            <Icon icon="mdi:fire" class="nav-icon" />
            <span class="nav-text">推荐</span>
          </router-link>
          <router-link to="/playlist" class="nav-item" active-class="active">
            <Icon icon="mdi:playlist-music" class="nav-icon" />
            <span class="nav-text">播放列表</span>
            <span class="nav-badge" v-if="player.playlist.length">{{
              player.playlist.length
              }}</span>
          </router-link>
          <router-link to="/fav" class="nav-item" active-class="active">
            <Icon icon="mdi:star-outline" class="nav-icon" />
            <span class="nav-text">收藏夹</span>
          </router-link>
        </nav>
        <div class="sidebar-spacer" />
        <nav class="sidebar-nav sidebar-nav-bottom">
          <router-link to="/settings" class="nav-item" active-class="active">
            <Icon icon="mdi:cog-outline" class="nav-icon" />
            <span class="nav-text">设置</span>
          </router-link>
        </nav>
      </aside>

      <main class="main-content">
        <ScrollAreaRoot class="scrollarea-root">
          <ScrollAreaViewport class="scrollarea-viewport">
            <router-view :key="$route.name" />
          </ScrollAreaViewport>
          <ScrollAreaScrollbar class="scrollarea-scrollbar" orientation="vertical">
            <ScrollAreaThumb class="scrollarea-thumb" />
          </ScrollAreaScrollbar>
          <ScrollAreaCorner class="scrollarea-corner" />
        </ScrollAreaRoot>
      </main>
    </div>

    <PlayerBar />

    <KeepAlive>
      <LyricsOverlay :visible="showLyricsOverlay" @close="showLyricsOverlay = false" />
    </KeepAlive>

    <audio ref="audioRef" crossorigin="anonymous" @timeupdate="player.updateTime($event.target.currentTime)" @ended="player.onEnded()"
      @loadedmetadata="player.setDuration($event.target.duration)" @error="player.isPlaying = false" preload="auto" />

    <ToastProvider>
      <ToastRoot v-for="toast in toasts" :key="toast.id" :duration="3000" class="toast-root"
        :class="'toast-' + toast.type">
        <div class="toast-content">
          <Icon :icon="toast.type === 'error' ? 'mdi:alert-circle' : 'mdi:check-circle'" class="toast-icon" />
          <ToastDescription class="toast-description">{{
            toast.message
            }}</ToastDescription>
        </div>
        <ToastClose class="toast-close" aria-label="关闭">
          <Icon icon="mdi:close" />
        </ToastClose>
      </ToastRoot>
      <ToastViewport class="toast-viewport" />
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
 * │ Sidebar│  Main (ScrollArea + router) │
 * ├────────┴─────────────────────────────┤
 * │ PlayerBar                            │
 * └──────────────────────────────────────┘
 *
 * 额外：歌词弹层 (LyricsOverlay)、Toast 通知
 */

import { ref, computed, watch, onMounted, onUnmounted, provide, defineAsyncComponent } from "vue";
import { useRouter, useRoute } from "vue-router";
import { usePlayerStore } from "./stores/player";
import { useUserStore } from "./stores/user";
import { useToast } from "./stores/toast";
import { Icon } from "@iconify/vue";
import PlayerBar from "./components/PlayerBar.vue";
import LoginPanel from "./components/LoginPanel.vue";
import {
  ScrollAreaRoot,
  ScrollAreaViewport,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaCorner,
  AutocompleteRoot,
  AutocompleteAnchor,
  AutocompleteInput,
  AutocompleteCancel,
  AutocompletePortal,
  AutocompleteContent,
  AutocompleteViewport,
  AutocompleteGroup,
  AutocompleteLabel,
  AutocompleteItem,
  AutocompleteEmpty,
  ToastProvider,
  ToastRoot,
  ToastDescription,
  ToastClose,
  ToastViewport,
} from "reka-ui";

// ── 常量 ──
const HISTORY_KEY = "bilimusic_search_history";
const MAX_HISTORY = 20;
const isMac = navigator.platform.startsWith("Mac"); // 编译时确定，无需响应式

// ── 异步组件（懒加载） ──
const LyricsOverlay = defineAsyncComponent(() => import("./components/LyricsOverlay.vue"));

// ── Store / Router ──
const router = useRouter();
const route = useRoute();
const player = usePlayerStore();
const user = useUserStore();
const { toasts } = useToast();

// ── 响应式状态 ──
const searchQuery = ref(""); // 搜索框输入
const audioRef = ref(null); // <audio> 元素引用
const searchKey = ref(0); // 强制重搜时递增
const showLyricsOverlay = ref(false); // 歌词弹层可见性

// 向下提供（给子组件使用）
provide("searchKey", searchKey);
provide("toggleLyricsOverlay", () => {
  showLyricsOverlay.value = !showLyricsOverlay.value;
});

// 搜索下拉面板
const showDropdown = ref(false);
const suggestions = ref([]); // 搜索建议列表
const hotSearch = ref([]); // 热搜列表
const history = ref([]); // 搜索历史
const suggestTimer = ref(null); // 输入防抖定时器（ref 确保组件卸载时清理）

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

// ── 搜索历史管理 ──

/** 从 localStorage 加载搜索历史 */
function loadHistory() {
  try {
    history.value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    history.value = [];
  }
}

/** 保存关键词到搜索历史（去重、上限 MAX_HISTORY） */
function saveHistoryItem(keyword) {
  loadHistory();
  const idx = history.value.indexOf(keyword);
  if (idx >= 0) history.value.splice(idx, 1);
  history.value.unshift(keyword);
  if (history.value.length > MAX_HISTORY)
    history.value = history.value.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value));
}

/** 清空搜索历史 */
function clearHistory() {
  history.value = [];
  localStorage.removeItem(HISTORY_KEY);
}

// ── 搜索建议 & 热搜 ──

/** 获取 B站热搜词 */
async function fetchHotSearch() {
  try {
    const result = await window.electronAPI.getHotSearch();
    if (Array.isArray(result)) hotSearch.value = result;
    else if (result.error) console.error("[BiliMusic] Hot search error:", result.error);
  } catch (e) {
    console.error("[BiliMusic] Failed to fetch hot search:", e);
  }
}

/** 获取搜索建议（200ms 防抖） */
async function fetchSuggestions(term) {
  try {
    const result = await window.electronAPI.getSearchSuggest(term);
    suggestions.value = Array.isArray(result) ? result : [];
  } catch {
    suggestions.value = [];
  }
}

/** 搜索框输入事件 — 空时显示历史+热搜，非空时请求建议 */
function onInput() {
  clearTimeout(suggestTimer.value);
  if (!searchQuery.value) {
    suggestions.value = [];
    loadHistory();
    fetchHotSearch();
    return;
  }
  suggestTimer.value = setTimeout(() => fetchSuggestions(searchQuery.value), 200);
}

/** 选中下拉建议项 → 保存历史 + 跳转搜索页 */
function selectSuggestion(value) {
  showDropdown.value = false;
  saveHistoryItem(value);
  router.push({ path: "/search", query: { q: value } }).catch(() => searchKey.value++);
}

/** 侧边栏返回按钮 — 跟踪路由深度，无历史时置灰 */
const historyDepth = ref(0)
const canGoBack = computed(() => historyDepth.value > 0)
let isBackNav = false
watch(() => route.fullPath, () => {
  if (isBackNav) { isBackNav = false; return }
  historyDepth.value++
})

function goBack() {
  if (!historyDepth.value) return
  isBackNav = true
  historyDepth.value--
  router.back()
}

/** 按回车搜索 */
async function doSearch() {
  if (!searchQuery.value.trim()) return;
  const q = searchQuery.value.trim();
  showDropdown.value = false;
  saveHistoryItem(q);
  try {
    await router.push({ path: "/search", query: { q } });
  } catch {
    searchKey.value++;
  }
}

// ── 生命周期 ──
onMounted(() => {
  // 关联 <audio> 元素到 player store
  if (audioRef.value) player.setAudioElement(audioRef.value);

  // 歌词编辑器保存后自动刷新歌词
  if (window.electronAPI?.onLyricsEditorSaved) {
    window.electronAPI.onLyricsEditorSaved(() => {
      const track = player.currentTrack.value;
      if (track?.bvid) player.loadLyrics(track.bvid, track.cid || "", track.title);
    });
  }

  loadHistory();

  // 窗口最大化状态同步
  window.electronAPI?.isMaximized().then((v) => (isMaxed.value = v));
  window.electronAPI?.onMaximizeChange((v) => (isMaxed.value = v));
  window.electronAPI
    ?.ensureSession()
    .catch((e) => console.warn("[BiliMusic] Session init:", e));
});

onUnmounted(() => {
  clearTimeout(suggestTimer.value);
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg,
      var(--bg-deep) 0%,
      var(--bg-primary) 50%,
      var(--bg-deep) 100%);
}

.app-header {
  display: flex;
  align-items: center;
  height: var(--header-height);
  padding: 0 20px;
  background: rgba(22, 22, 42, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  gap: 20px;
  flex-shrink: 0;
  z-index: 10;
  -webkit-app-region: drag;
}

.app-header.is-mac {
  padding-left: 80px;
}

.drag-region {
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 140px;
  padding-left: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 4px;
}

.logo-icon {
  font-size: 26px;
  color: var(--accent);
}

.logo-text {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1.5px;
  background: linear-gradient(135deg, var(--accent) 0%, #00a1d6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  -webkit-app-region: no-drag;
}

.autocomplete-root {
  width: 100%;
  max-width: 420px;
}

.search-bar {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 0 16px;
  transition: border-color var(--transition);
  width: 420px;
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
  padding: 10px 12px;
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

.header-right {
  min-width: 140px;
  display: flex;
  justify-content: flex-end;
  -webkit-app-region: no-drag;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  margin-left: -20px;
  height: var(--header-height);
}

.win-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
  -webkit-app-region: no-drag;
}

.win-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.win-btn-close:hover {
  background: #e81123;
  color: #fff;
}

.win-btn svg {
  display: block;
  width: 14px;
  height: 14px;
}

.win-btn-minimize svg {
  width: 12px;
  height: 12px;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow: hidden;
  background: transparent;
}

.sidebar {
  width: var(--sidebar-width);
  background: rgba(15, 15, 26, 0.6);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 12px 0;
  align-items: center;
}

.nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0 0 10px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition);
  font-size: 28px;
  flex-shrink: 0;
}

.nav-back:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-back:active:not(:disabled) {
  transform: scale(0.9);
}

.nav-back:disabled {
  opacity: 0.25;
  cursor: default;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 0 8px;
}

.sidebar-spacer {
  flex: 1;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition);
  font-size: 10px;
  text-decoration: none;
  position: relative;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.nav-item.active {
  background: var(--accent-dim);
  color: var(--accent);
}

.nav-item.active::before {
  content: "";
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--accent);
  border-radius: 0 3px 3px 0;
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-text {
  font-size: 10px;
  line-height: 1;
  font-weight: 500;
}

.nav-badge {
  position: absolute;
  top: 2px;
  right: 6px;
  background: var(--accent);
  color: var(--bg-deep);
  font-size: 9px;
  font-weight: 700;
  min-width: 16px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}
</style>
