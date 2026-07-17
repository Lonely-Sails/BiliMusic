<template>
  <div class="settings-view">
    <div class="settings-header">
      <h2>
        <Icon icon="mdi:cog-outline" class="section-icon" />设置
      </h2>
    </div>
    <div class="settings-body">
      <div class="setting-card">
        <div class="setting-card-header">
          <Icon icon="mdi:account-circle-outline" class="card-icon" /><span>账号</span>
        </div>
        <div class="setting-card-body">
          <div v-if="!user.loggedIn" class="setting-row">
            <span class="setting-label">登录状态</span><span class="setting-value text-muted">未登录</span>
          </div>
          <template v-else>
            <div class="setting-row">
              <span class="setting-label">登录账号</span><span class="setting-value">{{ user.nickname }}</span>
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
                    <SelectContent class="select-content" side="bottom" align="end">
                      <SelectViewport>
                        <SelectItem v-for="folder in folders" :key="folder.id" :value="String(folder.id)">
                          <SelectItemText>{{ folder.title }}</SelectItemText>
                          <span class="select-item-count">{{ folder.mediaCount }} 项</span>
                        </SelectItem>
                        <SelectSeparator class="select-separator" />
                        <SelectItem value="__none__">
                          <SelectItemText class="text-muted">不使用收藏夹</SelectItemText>
                        </SelectItem>
                      </SelectViewport>
                    </SelectContent>
                  </SelectPortal>
                </SelectRoot>
                <span v-if="user.favFolderName" class="fav-hint">
                  <Icon icon="mdi:check-circle" class="hint-icon" />歌曲将收藏到「{{ user.favFolderName }}」
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="setting-card">
        <div class="setting-card-header">
          <Icon icon="mdi:music-note-outline" class="card-icon" /><span>歌词</span>
        </div>
        <div class="setting-card-body">
          <div class="setting-row">
            <span class="setting-label">桌面歌词</span>
            <button class="setting-btn setting-btn-accent" @click="toggleDesktopLyrics">
              <Icon :icon="desktopLyricsVisible ? 'mdi:eye-off-outline' : 'mdi:music-note-outline'" />{{
                desktopLyricsVisible
              ? '隐藏' : '打开' }}
            </button>
          </div>
          <div class="setting-row">
            <span class="setting-label">本地歌词文件夹</span>
            <button class="setting-btn" @click="openLyricsFolder">
              <Icon icon="mdi:folder-open-outline" />打开文件夹
            </button>
          </div>
          <div class="setting-row setting-row-footer">
            <span class="setting-label" />
            <button class="setting-btn setting-btn-danger" @click="clearLocalLyrics">
              <Icon icon="mdi:delete-outline" />清理本地歌词
            </button>
          </div>
        </div>
      </div>

      <div class="setting-card">
        <div class="setting-card-header">
          <Icon icon="mdi:play-circle-outline" class="card-icon" /><span>播放</span>
        </div>
        <div class="setting-card-body">
          <div class="setting-row">
            <span class="setting-label">
              <span>音量均衡</span>
              <span class="inline-hint">
                <Icon icon="mdi:information-outline" class="desc-icon" />
                自动调节音量，让每首歌听起来响度一致
              </span>
            </span>
            <div class="setting-control-row">
              <SwitchRoot class="switch-root" :model-value="player.loudnessEnabled" @update:model-value="onLoudnessToggle">
                <SwitchThumb class="switch-thumb" />
              </SwitchRoot>
            </div>
          </div>
        </div>
      </div>

      <div class="setting-card">
        <div class="setting-card-header">
          <Icon icon="mdi:alpha-b-circle-outline" class="card-icon" /><span>B站相关</span>
        </div>
        <div class="setting-card-body">
          <div class="setting-row">
            <span class="setting-label">
              <span>搜索限制音乐区</span>
              <span class="inline-hint">
                <Icon icon="mdi:information-outline" class="desc-icon" />
                关闭后可搜索B站全站视频
              </span>
            </span>
            <div class="setting-control-row">
              <SwitchRoot class="switch-root" :model-value="player.searchMusicOnly" @update:model-value="onSearchMusicOnlyChange">
                <SwitchThumb class="switch-thumb" />
              </SwitchRoot>
            </div>
          </div>
        </div>
      </div>

      <div class="setting-card">
        <div class="setting-card-header">
          <Icon icon="mdi:database-outline" class="card-icon" />
          <span>缓存</span>
          <span class="header-hint">
            <Icon icon="mdi:information-outline" class="desc-icon" />
            缓存搜索、榜单、歌词等 API 请求结果，减少重复请求
          </span>
        </div>
        <div class="setting-card-body">
          <div class="setting-row">
            <span class="setting-label">API 响应缓存上限</span>
            <div class="setting-control-row">
              <NumberFieldRoot class="number-field" :model-value="responseCacheMax" :min="50" :max="5000" :step="50"
                @update:model-value="onResponseCacheMaxChange">
                <NumberFieldDecrement class="nf-btn">
                  <Icon icon="mdi:minus" />
                </NumberFieldDecrement>
                <NumberFieldInput class="nf-input" />
                <NumberFieldIncrement class="nf-btn">
                  <Icon icon="mdi:plus" />
                </NumberFieldIncrement>
              </NumberFieldRoot>
              <span class="setting-hint" v-if="apiCacheLoading">获取中...</span>
              <span class="setting-hint" v-else>当前 {{ apiCacheSize }} 项</span>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">音频链接缓存</span>
            <div class="setting-control-row">
              <span class="setting-hint" v-if="audioCacheInfo">当前 {{ audioCacheInfo.size }} / {{ audioCacheInfo.max }}
                项</span>
            </div>
          </div>
          <div class="setting-row setting-row-footer">
            <span class="setting-label">总计 {{ (audioCacheInfo?.size || 0) + apiCacheSize }} 项</span>
            <button class="setting-btn" @click="clearAllCache">
              <Icon icon="mdi:delete-outline" />清空所有缓存
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import { usePlayerStore } from '../../stores/player'
import { useToast } from '../../stores/toast'
import { Icon } from '@iconify/vue'
import { SelectRoot, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectSeparator, NumberFieldRoot, NumberFieldInput, NumberFieldDecrement, NumberFieldIncrement, SwitchRoot, SwitchThumb } from 'reka-ui'

const user = useUserStore()
const player = usePlayerStore()
const { showToast } = useToast()
const folders = ref([])
const selectedFavFolder = ref(user.favFolderId ? String(user.favFolderId) : '__none__')
const loadingFolders = ref(false)
const desktopLyricsVisible = ref(false)
const audioCacheInfo = ref(null)
const apiCacheSize = ref(0)
const responseCacheMax = ref(500)
const apiCacheLoading = ref(true)

async function refreshCacheInfo() {
  audioCacheInfo.value = player.getAudioCacheInfo()
  if (window.electronAPI?.getResponseCacheStats) {
    try {
      apiCacheLoading.value = true
      const stats = await window.electronAPI.getResponseCacheStats()
      apiCacheSize.value = stats.size; responseCacheMax.value = stats.max
    } catch { } finally { apiCacheLoading.value = false }
  }
}

async function onResponseCacheMaxChange(val) {
  if (val == null || val < 50) val = 50
  if (val > 5000) val = 5000
  responseCacheMax.value = val
  if (window.electronAPI?.setResponseCacheMax) await window.electronAPI.setResponseCacheMax(val)
  refreshCacheInfo()
}

onMounted(() => {
  if (user.loggedIn) loadFolders()
  refreshCacheInfo()
  window.electronAPI?.onDesktopLyricsVisibility(v => desktopLyricsVisible.value = v)
})

async function loadFolders() {
  if (!user.loggedIn) return
  loadingFolders.value = true
  try {
    const result = await window.electronAPI.listFavFolders(user.uid)
    if (result && !result.error) folders.value = result
  } catch (e) { console.error('[BiliMusic] Load folders:', e) }
  finally { loadingFolders.value = false }
}

function onSelectFavFolder(val) {
  if (val === '__none__') user.saveFavFolderSetting(null, '')
  else { const folder = folders.value.find(f => String(f.id) === val); if (folder) user.saveFavFolderSetting(folder.id, folder.title) }
  selectedFavFolder.value = val
}

function onLoudnessToggle(val) {
  player.loudnessEnabled = val
  showToast(val ? '音量均衡已开启' : '音量均衡已关闭')
}
function onSearchMusicOnlyChange(val) {
  player.searchMusicOnly = val
  showToast(val ? '已限制搜索到音乐区' : '搜索已取消限制')
}

function toggleDesktopLyrics() { window.electronAPI?.desktopLyricsToggle() }
function openLyricsFolder() { window.electronAPI?.openLyricsFolder() }

async function clearLocalLyrics() {
  if (!window.electronAPI?.clearLocalLyrics) return
  const result = await window.electronAPI.clearLocalLyrics()
  if (result?.success) showToast(result.cleared ? `已清理 ${result.cleared} 个本地歌词文件` : '没有本地歌词需要清理')
  else if (result?.error) showToast('清理失败: ' + result.error, 'error')
}

async function clearAllCache() {
  player.clearAudioCache()
  if (window.electronAPI?.clearResponseCache) await window.electronAPI.clearResponseCache()
  await refreshCacheInfo()
  showToast('缓存已清空')
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
}

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

.setting-row+.setting-row {
  border-top: 1px solid var(--border);
}

.setting-row-footer {
  border-top: 1px solid var(--border);
}

.setting-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.setting-control {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.setting-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.setting-btn:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}

.setting-btn-accent {
  border-color: var(--accent-dim);
  color: var(--accent);
}

.setting-btn-accent:hover {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.08);
}

.setting-btn-danger {
  color: var(--danger);
}

.setting-btn-danger:hover {
  border-color: var(--danger);
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

.select-chevron {
  font-size: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
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

.setting-control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.header-hint {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.desc-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.inline-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  white-space: nowrap;
}



/* ── Switch (Reka UI) ── */
.switch-root {
  all: unset;
  width: 44px;
  height: 24px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: all var(--transition);
  flex-shrink: 0;
}

.switch-root[data-state='checked'] {
  background: var(--accent);
  border-color: var(--accent);
}

.switch-thumb {
  display: block;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 999px;
  transition: transform var(--transition);
  transform: translateX(2px);
  will-change: transform;
}

.switch-root[data-state='checked'] .switch-thumb {
  transform: translateX(24px);
}
</style>
