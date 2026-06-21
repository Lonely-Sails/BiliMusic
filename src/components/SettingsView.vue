<template>
  <div class="settings-view">
    <div class="settings-header">
      <h2>
        <Icon icon="mdi:cog-outline" class="section-icon" />
        设置
      </h2>
    </div>

    <div class="settings-body">
      <!-- 账号卡片 -->
      <div class="setting-card">
        <div class="setting-card-header">
          <Icon icon="mdi:account-circle-outline" class="card-icon" />
          <span>账号</span>
        </div>

        <div class="setting-card-body">
          <!-- 未登录 -->
          <div v-if="!user.loggedIn" class="setting-row">
            <span class="setting-label">登录状态</span>
            <span class="setting-value text-muted">未登录</span>
          </div>

          <!-- 已登录 -->
          <template v-else>
            <div class="setting-row">
              <span class="setting-label">登录账号</span>
              <span class="setting-value">{{ user.nickname }}</span>
            </div>

            <div class="setting-row">
              <span class="setting-label">歌曲收藏夹</span>
              <div class="setting-control">
                <SelectRoot v-model="selectedFavFolder" @update:model-value="onSelectFavFolder">
                  <SelectTrigger class="setting-select-trigger">
                    <SelectValue :placeholder="loadingFolders ? '加载中...' : '选择收藏夹'" />
                    <Icon icon="mdi:chevron-down" class="select-chevron" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectContent class="setting-select-content" side="bottom" align="end">
                      <SelectViewport>
                        <SelectItem
                          v-for="folder in folders"
                          :key="folder.id"
                          :value="String(folder.id)"
                          class="setting-select-item"
                        >
                          <SelectItemText>{{ folder.title }}</SelectItemText>
                          <span class="select-item-count">{{ folder.mediaCount }} 项</span>
                        </SelectItem>
                        <SelectSeparator class="setting-select-separator" />
                        <SelectItem
                          value="__none__"
                          class="setting-select-item"
                        >
                          <SelectItemText class="text-muted">不使用收藏夹</SelectItemText>
                        </SelectItem>
                      </SelectViewport>
                    </SelectContent>
                  </SelectPortal>
                </SelectRoot>
                <span v-if="user.favFolderName" class="fav-hint">
                  <Icon icon="mdi:check-circle" class="hint-icon" />
                  歌曲将收藏到「{{ user.favFolderName }}」
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 歌词卡片 -->
      <div class="setting-card">
        <div class="setting-card-header">
          <Icon icon="mdi:music-note-outline" class="card-icon" />
          <span>歌词</span>
        </div>

        <div class="setting-card-body">
          <div class="setting-row">
            <span class="setting-label">桌面歌词</span>
            <button
              class="setting-btn setting-btn-accent"
              @click="toggleDesktopLyrics"
            >
              <Icon :icon="desktopLyricsVisible ? 'mdi:eye-off-outline' : 'mdi:music-note-outline'" />
              {{ desktopLyricsVisible ? '隐藏' : '打开' }}
            </button>
          </div>
          <div class="setting-row">
            <span class="setting-label">本地歌词文件夹</span>
            <button class="setting-btn" @click="openLyricsFolder">
              <Icon icon="mdi:folder-open-outline" /> 打开文件夹
            </button>
          </div>
          <div class="setting-row setting-row-footer">
            <span class="setting-label"></span>
            <button class="setting-btn setting-btn-danger" @click="clearLocalLyrics">
              <Icon icon="mdi:delete-outline" /> 清理本地歌词
            </button>
          </div>
        </div>
      </div>

      <!-- 高级卡片 -->
      <div class="setting-card">
        <div class="setting-card-header">
          <Icon icon="mdi:tune-variant" class="card-icon" />
          <span>高级</span>
        </div>

        <div class="setting-card-body">
          <div class="setting-row">
            <span class="setting-label">歌曲链接缓存上限</span>
            <div class="setting-control-row">
              <NumberFieldRoot
                class="number-field"
                :model-value="audioLimit"
                :min="10"
                :max="500"
                :step="10"
                @update:model-value="onAudioLimitChange"
              >
                <NumberFieldDecrement class="nf-btn">
                  <Icon icon="mdi:minus" />
                </NumberFieldDecrement>
                <NumberFieldInput class="nf-input" />
                <NumberFieldIncrement class="nf-btn">
                  <Icon icon="mdi:plus" />
                </NumberFieldIncrement>
              </NumberFieldRoot>
              <span class="setting-hint">当前 {{ cacheInfo.audio.size }} 项</span>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">歌词缓存上限</span>
            <div class="setting-control-row">
              <NumberFieldRoot
                class="number-field"
                :model-value="lyricLimit"
                :min="5"
                :max="200"
                :step="5"
                @update:model-value="onLyricLimitChange"
              >
                <NumberFieldDecrement class="nf-btn">
                  <Icon icon="mdi:minus" />
                </NumberFieldDecrement>
                <NumberFieldInput class="nf-input" />
                <NumberFieldIncrement class="nf-btn">
                  <Icon icon="mdi:plus" />
                </NumberFieldIncrement>
              </NumberFieldRoot>
              <span class="setting-hint">当前 {{ cacheInfo.lyric.size }} 项</span>
            </div>
          </div>
          <div class="setting-row setting-row-footer">
            <span class="setting-label">总计 {{ cacheInfo.audio.size + cacheInfo.lyric.size }} 项</span>
            <button class="setting-btn" @click="clearCache">
              <Icon icon="mdi:delete-outline" /> 清空缓存
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../stores/toast'
import { Icon } from '@iconify/vue'
import {
  SelectRoot, SelectTrigger, SelectValue, SelectPortal,
  SelectContent, SelectViewport, SelectItem, SelectItemText,
  SelectSeparator,
  NumberFieldRoot, NumberFieldInput, NumberFieldDecrement, NumberFieldIncrement
} from 'reka-ui'

export default {
  name: 'SettingsView',
  components: {
    Icon,
    SelectRoot, SelectTrigger, SelectValue, SelectPortal,
    SelectContent, SelectViewport, SelectItem, SelectItemText,
    SelectSeparator,
    NumberFieldRoot, NumberFieldInput, NumberFieldDecrement, NumberFieldIncrement
  },
  setup() {
    const user = useUserStore()
    const player = usePlayerStore()
    const { showToast } = useToast()
    const folders = ref([])
    const selectedFavFolder = ref(user.favFolderId ? String(user.favFolderId) : '__none__')
    const loadingFolders = ref(false)
    const cacheInfo = reactive({ audio: { size: 0, max: 0 }, lyric: { size: 0, max: 0 } })
    const desktopLyricsVisible = ref(false)
    const audioLimit = ref(100)
    const lyricLimit = ref(20)

    function refreshCacheInfo() {
      const info = player.getCacheInfo()
      cacheInfo.audio = { ...info.audio }
      cacheInfo.lyric = { ...info.lyric }
    }

    onMounted(() => {
      if (user.loggedIn) {
        loadFolders()
      }
      refreshCacheInfo()
      audioLimit.value = cacheInfo.audio.max
      lyricLimit.value = cacheInfo.lyric.max

      if (window.electronAPI?.onDesktopLyricsVisibility) {
        window.electronAPI.onDesktopLyricsVisibility((visible) => {
          desktopLyricsVisible.value = visible
        })
      }
    })

    async function loadFolders() {
      if (!user.loggedIn) return
      loadingFolders.value = true
      try {
        const result = await window.electronAPI.listFavFolders(user.uid)
        if (result && !result.error) {
          folders.value = result
        }
      } catch (e) {
        console.error('Failed to load folders:', e)
      } finally {
        loadingFolders.value = false
      }
    }

    function onSelectFavFolder(val) {
      if (val === '__none__') {
        user.saveFavFolderSetting(null, '')
      } else {
        const folder = folders.value.find((f) => String(f.id) === val)
        if (folder) {
          user.saveFavFolderSetting(folder.id, folder.title)
        }
      }
      selectedFavFolder.value = val
    }

    function onAudioLimitChange(val) {
      if (val == null || val < 10) val = 10
      if (val > 500) val = 500
      audioLimit.value = val
      player.updateCacheLimits(val, lyricLimit.value)
      refreshCacheInfo()
    }

    function onLyricLimitChange(val) {
      if (val == null || val < 5) val = 5
      if (val > 200) val = 200
      lyricLimit.value = val
      player.updateCacheLimits(audioLimit.value, val)
      refreshCacheInfo()
    }

    function toggleDesktopLyrics() {
      if (window.electronAPI?.desktopLyricsToggle) {
        window.electronAPI.desktopLyricsToggle()
      }
    }

    function openLyricsFolder() {
      if (window.electronAPI?.openLyricsFolder) {
        window.electronAPI.openLyricsFolder()
      }
    }

    async function clearLocalLyrics() {
      if (!window.electronAPI?.clearLocalLyrics) return
      const result = await window.electronAPI.clearLocalLyrics()
      if (result?.success) {
        const count = result.cleared || 0
        if (count > 0) {
          showToast(`已清理 ${count} 个本地歌词文件`)
        } else {
          showToast('没有本地歌词需要清理')
        }
      } else if (result?.error) {
        showToast('清理失败: ' + result.error, 'error')
      }
    }

    function clearCache() {
      player.clearAllCaches()
      refreshCacheInfo()
    }

    return { user, player, folders, selectedFavFolder, loadingFolders, cacheInfo, audioLimit, lyricLimit, desktopLyricsVisible, onSelectFavFolder, onAudioLimitChange, onLyricLimitChange, toggleDesktopLyrics, openLyricsFolder, clearLocalLyrics, clearCache, refreshCacheInfo }
  }
}
</script>

<style scoped>
.settings-view {
  padding: 28px 32px;
}

.settings-header {
  margin-bottom: 28px;
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

/* ── Setting Card ── */
.setting-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.setting-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
}

.card-icon {
  font-size: 20px;
  color: var(--accent);
}

.setting-card-body {
  padding: 8px 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  gap: 16px;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--border);
}

.setting-label {
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.setting-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.text-muted {
  color: var(--text-muted);
}

/* ── Select ── */
.setting-control {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.setting-select-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  min-width: 180px;
  justify-content: space-between;
  transition: border-color var(--transition);
  font-family: inherit;
}

.setting-select-trigger:hover {
  border-color: var(--accent-dim);
}

.setting-select-trigger:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.select-chevron {
  font-size: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.setting-select-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px var(--shadow);
  z-index: 100;
  max-height: 300px;
  overflow: hidden;
}

.setting-select-content .setting-select-viewport {
  padding: 4px;
}

.setting-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  outline: none;
  transition: background var(--transition);
}

.setting-select-item:hover,
.setting-select-item[data-highlighted] {
  background: var(--bg-hover);
}

.setting-select-item[data-state="checked"] {
  color: var(--accent);
}

.select-item-count {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.setting-select-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
}

.fav-hint {
  font-size: 11px;
  color: var(--accent);
  display: flex;
  align-items: center;
  gap: 4px;
}

.hint-icon {
  font-size: 14px;
}

/* ── 歌词卡片 ── */
.setting-btn-accent {
  border-color: var(--accent-dim);
  color: var(--accent);
}

.setting-btn-accent:hover {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.08);
}

.setting-btn-danger {
  color: var(--danger, #ef4444);
}

.setting-btn-danger:hover {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
  background: rgba(239, 68, 68, 0.06);
}

/* ── 高级卡片 ── */
.setting-control-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.setting-btn:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.setting-row-footer {
  border-top: 1px solid var(--border-light) !important;
  background: rgba(255, 255, 255, 0.01);
}

.setting-hint {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
