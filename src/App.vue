<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header" :class="{ 'is-mac': isMac }">
      <!-- 窗口控制按钮 (Win/Linux) -->
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
        <AutocompleteRoot
          class="autocomplete-root"
          v-model="searchQuery"
          v-model:open="showDropdown"
          :open-on-focus="true"
          :open-on-click="true"
          :ignore-filter="true"
          @update:model-value="onInput"
        >
          <AutocompleteAnchor class="search-bar">
            <Icon icon="mdi:magnify" class="search-bar-icon" />
            <AutocompleteInput
              placeholder="搜索B站音乐..."
              class="search-input"
              @keyup.enter="doSearch"
            />
            <AutocompleteCancel v-if="searchQuery" as-child>
              <button class="search-clear">
                <Icon icon="mdi:close-circle" />
              </button>
            </AutocompleteCancel>
          </AutocompleteAnchor>

          <AutocompletePortal>
            <AutocompleteContent
              class="search-dropdown"
              position="popper"
              :side-offset="6"
              :hide-when-empty="false"
            >
              <AutocompleteViewport class="sd-viewport">
                <!-- 搜索建议（输入时） -->
                <AutocompleteGroup v-if="searchQuery && suggestions.length > 0">
                  <AutocompleteLabel class="sd-title">搜索建议</AutocompleteLabel>
                  <AutocompleteItem
                    v-for="s in suggestions"
                    :key="s.value"
                    :value="s.value"
                    class="sd-item"
                    @select="selectSuggestion(s.value)"
                  >
                    <Icon icon="mdi:magnify" class="sd-item-icon" />
                    <span>{{ s.name }}</span>
                  </AutocompleteItem>
                </AutocompleteGroup>

                <!-- 搜索历史 + 热搜（空输入时） -->
                <template v-if="!searchQuery">
                  <AutocompleteGroup v-if="history.length > 0">
                    <AutocompleteLabel class="sd-title sd-title-row">
                      <span>搜索历史</span>
                      <button class="sd-clear-btn" @click="clearHistory">清空</button>
                    </AutocompleteLabel>
                    <AutocompleteItem
                      v-for="h in history"
                      :key="h"
                      :value="h"
                      class="sd-item"
                      @select="selectSuggestion(h)"
                    >
                      <Icon icon="mdi:history" class="sd-item-icon" />
                      <span>{{ h }}</span>
                    </AutocompleteItem>
                  </AutocompleteGroup>

                  <AutocompleteGroup v-if="hotSearch.length > 0">
                    <AutocompleteLabel class="sd-title">B站热搜</AutocompleteLabel>
                    <AutocompleteItem
                      v-for="(hot, i) in hotSearch"
                      :key="'hot-' + i"
                      :value="hot.keyword"
                      class="sd-item"
                      @select="selectSuggestion(hot.keyword)"
                    >
                      <span class="sd-rank" :class="{ 'sd-rank-top': i < 3 }">{{ i + 1 }}</span>
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
      <!-- Sidebar -->
      <aside class="sidebar">
        <nav class="sidebar-nav">
          <router-link to="/home" class="nav-item" active-class="active">
            <Icon icon="mdi:fire" class="nav-icon" />
            <span class="nav-text">推荐</span>
          </router-link>
          <router-link to="/playlist" class="nav-item" active-class="active">
            <Icon icon="mdi:playlist-music" class="nav-icon" />
            <span class="nav-text">播放列表</span>
            <span class="nav-badge" v-if="player.playlist.length">{{ player.playlist.length }}</span>
          </router-link>
          <router-link to="/fav" class="nav-item" active-class="active">
            <Icon icon="mdi:star-outline" class="nav-icon" />
            <span class="nav-text">收藏夹</span>
          </router-link>
          <!-- 歌词已改为封面点击滑入弹层 -->
        </nav>
        <div class="sidebar-spacer"></div>
        <nav class="sidebar-nav sidebar-nav-bottom">
          <router-link to="/settings" class="nav-item" active-class="active">
            <Icon icon="mdi:cog-outline" class="nav-icon" />
            <span class="nav-text">设置</span>
          </router-link>
        </nav>
      </aside>

      <!-- Content -->
      <main class="main-content">
        <ScrollAreaRoot class="scrollarea-root">
          <ScrollAreaViewport class="scrollarea-viewport">
            <router-view :key="$route.fullPath" />
          </ScrollAreaViewport>
          <ScrollAreaScrollbar class="scrollarea-scrollbar" orientation="vertical">
            <ScrollAreaThumb class="scrollarea-thumb" />
          </ScrollAreaScrollbar>
          <ScrollAreaCorner class="scrollarea-corner" />
        </ScrollAreaRoot>
      </main>
    </div>

    <!-- Player Bar -->
    <PlayerBar />

    <!-- Lyrics Overlay (从下滑入) -->
    <LyricsOverlay
      :visible="showLyricsOverlay"
      @close="showLyricsOverlay = false"
    />

    <!-- Hidden audio element -->
    <audio
      ref="audioRef"
      @timeupdate="player.updateTime($event.target.currentTime)"
      @ended="player.onEnded()"
      @loadedmetadata="player.setDuration($event.target.duration)"
      @error="player.isPlaying = false"
      preload="auto"
    ></audio>

    <!-- Toast Notifications (Reka UI) -->
    <ToastProvider>
      <ToastRoot
        v-for="toast in toasts"
        :key="toast.id"
        :duration="3000"
        class="toast-root"
        :class="'toast-' + toast.type"
      >
        <div class="toast-content">
          <Icon :icon="toast.type === 'error' ? 'mdi:alert-circle' : 'mdi:check-circle'" class="toast-icon" />
          <ToastDescription class="toast-description">{{ toast.message }}</ToastDescription>
        </div>
        <ToastClose class="toast-close" aria-label="关闭">
          <Icon icon="mdi:close" />
        </ToastClose>
      </ToastRoot>
      <ToastViewport class="toast-viewport" />
    </ToastProvider>
  </div>
</template>

<script>
import { ref, onMounted, provide } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from './stores/player'
import { useUserStore } from './stores/user'
import { useToast } from './stores/toast'
import { Icon } from '@iconify/vue'
import PlayerBar from './components/PlayerBar.vue'
import LyricsOverlay from './components/LyricsOverlay.vue'
import LoginPanel from './components/LoginPanel.vue'
import {
  ScrollAreaRoot, ScrollAreaViewport,
  ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner,
  AutocompleteRoot, AutocompleteAnchor, AutocompleteInput,
  AutocompleteCancel, AutocompletePortal, AutocompleteContent,
  AutocompleteViewport, AutocompleteGroup, AutocompleteLabel,
  AutocompleteItem, AutocompleteEmpty,
  ToastProvider, ToastRoot, ToastDescription, ToastClose, ToastViewport
} from 'reka-ui'

const HISTORY_KEY = 'bilimusic_search_history'
const MAX_HISTORY = 20

export default {
  name: 'App',
  components: {
    PlayerBar, LyricsOverlay, LoginPanel, Icon,
    ScrollAreaRoot, ScrollAreaViewport,
    ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner,
    AutocompleteRoot, AutocompleteAnchor, AutocompleteInput,
    AutocompleteCancel, AutocompletePortal, AutocompleteContent,
    AutocompleteViewport, AutocompleteGroup, AutocompleteLabel,
    AutocompleteItem, AutocompleteEmpty,
    ToastProvider, ToastRoot, ToastDescription, ToastClose, ToastViewport
  },
  setup() {
    const searchQuery = ref('')
    const audioRef = ref(null)
    const player = usePlayerStore()
    const user = useUserStore()
    const { toasts } = useToast()
    const router = useRouter()
    const searchKey = ref(0)
    // 歌词弹层状态
    const showLyricsOverlay = ref(false)
    provide('searchKey', searchKey)
    provide('toggleLyricsOverlay', () => {
      showLyricsOverlay.value = !showLyricsOverlay.value
    })

    // 搜索下拉面板
    const showDropdown = ref(false)
    const suggestions = ref([])
    const hotSearch = ref([])
    const history = ref([])
    let suggestTimer = null

    // 平台检测 & 窗口控制
    const isMac = ref(navigator.platform.startsWith('Mac'))
    const isMaxed = ref(false)

    function minimizeWindow() { window.electronAPI?.minimizeWindow() }
    function maximizeWindow() { window.electronAPI?.maximizeWindow() }
    function closeWindow() { window.electronAPI?.closeWindow() }

    function loadHistory() {
      try {
        const raw = localStorage.getItem(HISTORY_KEY)
        history.value = raw ? JSON.parse(raw) : []
      } catch { history.value = [] }
    }

    function saveHistoryItem(keyword) {
      loadHistory()
      const idx = history.value.indexOf(keyword)
      if (idx >= 0) history.value.splice(idx, 1)
      history.value.unshift(keyword)
      if (history.value.length > MAX_HISTORY) history.value = history.value.slice(0, MAX_HISTORY)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
    }

    function clearHistory() {
      history.value = []
      localStorage.removeItem(HISTORY_KEY)
    }

    async function fetchHotSearch() {
      try {
        const result = await window.electronAPI.getHotSearch()
        if (Array.isArray(result)) hotSearch.value = result
        else if (result.error) console.error('Hot search error:', result.error)
      } catch (e) {
        console.error('Failed to fetch hot search:', e)
      }
    }

    async function fetchSuggestions(term) {
      try {
        const result = await window.electronAPI.getSearchSuggest(term)
        if (Array.isArray(result)) suggestions.value = result
        else suggestions.value = []
      } catch {
        suggestions.value = []
      }
    }

    function onInput() {
      clearTimeout(suggestTimer)
      if (!searchQuery.value) {
        suggestions.value = []
        loadHistory()
        fetchHotSearch()
        return
      }
      suggestTimer = setTimeout(() => {
        fetchSuggestions(searchQuery.value)
      }, 200)
    }

    function selectSuggestion(value) {
      showDropdown.value = false
      saveHistoryItem(value)
      router.push({ path: '/search', query: { q: value } }).catch(() => {
        searchKey.value++
      })
    }

    onMounted(() => {
      if (audioRef.value) {
        player.setAudioElement(audioRef.value)
      }

      // 编辑器保存本地歌词后刷新缓存
      if (window.electronAPI?.onLyricsEditorSaved) {
        window.electronAPI.onLyricsEditorSaved(() => {
          const track = player.currentTrack.value
          if (track?.bvid) {
            player.loadLyrics(track.bvid, track.cid || '', track.title)
          }
        })
      }

      loadHistory()

      // 窗口最大化状态
      window.electronAPI?.isMaximized().then(maximized => {
        isMaxed.value = maximized
      })
      window.electronAPI?.onMaximizeChange((maximized) => {
        isMaxed.value = maximized
      })

      // 启动时初始化 B站 session（buvid cookie + 可能的登录态）
      window.electronAPI.ensureSession().catch((e) => {
        console.warn('Session init failed:', e)
      })
    })

    async function doSearch() {
      if (!searchQuery.value.trim()) return
      const q = searchQuery.value.trim()
      showDropdown.value = false
      saveHistoryItem(q)
      try {
        await router.push({ path: '/search', query: { q } })
      } catch {
        searchKey.value++
      }
    }

    return {
      searchQuery, audioRef, player, user, doSearch, toasts, showLyricsOverlay,
      showDropdown, suggestions, hotSearch, history,
      onInput, clearHistory, selectSuggestion,
      isMac, isMaxed, minimizeWindow, maximizeWindow, closeWindow
    }
  }
}
</script>

<style scoped>
</style>
