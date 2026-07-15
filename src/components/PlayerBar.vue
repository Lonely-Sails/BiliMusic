<template>
  <div class="player-bar">
    <div class="player-track-info" @click="openLyricsOverlay"
      :style="{ cursor: player.currentTrack ? 'pointer' : 'default' }" :title="player.currentTrack ? '点击打开歌词' : ''">
      <div class="player-cover" v-if="player.currentTrack">
        <img :src="player.currentTrack.cover + '@160w_160h.webp'" :alt="player.currentTrack.title" />
        <div class="player-cover-overlay">
          <Icon icon="mdi:arrow-expand-all" class="cover-expand-icon" />
        </div>
      </div>
      <div class="player-cover placeholder" v-else>
        <Icon icon="mdi:music-note" class="placeholder-icon" />
      </div>
      <div class="player-meta" v-if="player.currentTrack">
        <div class="player-title">{{ player.currentTrack.title }}</div>
        <div class="player-author">{{ player.currentTrack.author || '未知' }}</div>
      </div>
      <div class="player-meta placeholder-text" v-else>
        <div class="player-title">未在播放</div>
        <div class="player-author">搜索歌曲开始播放</div>
      </div>
    </div>

    <div class="player-controls">
      <div class="controls-buttons">
        <TooltipProvider>
          <TooltipRoot>
            <TooltipTrigger as-child>
              <button class="ctrl-btn" :class="{ active: player.playMode !== 0 }" @click="player.cyclePlayMode()">
                <Icon :icon="modeIcon" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                {{ modeText }}
                <TooltipArrow class="tooltip-arrow" />
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

          <TooltipRoot>
            <TooltipTrigger as-child>
              <button class="ctrl-btn" @click="player.prevTrack()" :disabled="!player.currentTrack">
                <Icon icon="mdi:skip-previous" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                上一首
                <TooltipArrow class="tooltip-arrow" />
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

          <TooltipRoot>
            <TooltipTrigger as-child>
              <button class="ctrl-btn play-btn" @click="player.togglePlay()" :disabled="!player.currentTrack">
                <Icon :icon="player.isPlaying ? 'mdi:pause' : 'mdi:play'" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                {{ player.isPlaying ? '暂停' : '播放' }}
                <TooltipArrow class="tooltip-arrow" />
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

          <TooltipRoot>
            <TooltipTrigger as-child>
              <button class="ctrl-btn" @click="player.nextTrack()" :disabled="!player.currentTrack">
                <Icon icon="mdi:skip-next" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                下一首
                <TooltipArrow class="tooltip-arrow" />
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

          <HoverCardRoot :open-delay="0" :close-delay="200">
            <HoverCardTrigger as-child>
              <button class="ctrl-btn" @click="toggleMute">
                <Icon :icon="volumeIcon" />
              </button>
            </HoverCardTrigger>
            <HoverCardPortal>
              <HoverCardContent class="volume-hover-content" side="top" :side-offset="12">
                <div class="volume-popup-body">
                  <SliderRoot class="volume-popup-slider" orientation="vertical"
                    :model-value="[muted ? 0 : player.volume]" :max="1" :step="0.05"
                    @update:model-value="([val]) => { player.setVolume(val); muted = false }">
                    <SliderTrack class="volume-popup-track">
                      <SliderRange class="volume-popup-range" />
                    </SliderTrack>
                    <SliderThumb class="volume-popup-thumb" />
                  </SliderRoot>
                </div>
                <div class="volume-popup-label">{{ muted ? 0 : Math.round(player.volume * 100) }}%</div>
              </HoverCardContent>
            </HoverCardPortal>
          </HoverCardRoot>

          <TooltipRoot>
            <TooltipTrigger as-child>
              <button class="ctrl-btn" :class="{ active: desktopLyricsOpen }" @click="toggleDesktopLyrics">
                <Icon icon="mdi:monitor-screenshot" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                {{ desktopLyricsOpen ? '关闭桌面歌词' : '桌面歌词' }}
                <TooltipArrow class="tooltip-arrow" />
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </TooltipProvider>
      </div>

      <div class="progress-area">
        <span class="time current">{{ formatCurrentTime }}</span>
        <SliderRoot class="progress-bar" :model-value="[player.currentTime]" :max="player.duration || 1" :step="1"
          :disabled="!player.currentTrack" @update:model-value="([val]) => player.seek(val)">
          <SliderTrack class="slider-track">
            <SliderRange class="slider-range" />
          </SliderTrack>
          <SliderThumb class="slider-thumb" />
        </SliderRoot>
        <span class="time total">{{ formatDuration }}</span>
      </div>
    </div>

  </div>
</template>

<script setup>
/**
 * PlayerBar.vue — 底部播放控制栏
 *
 * 布局：歌曲信息 | 播放控制(模式/上/播放/下/音量悬浮/桌面) | 进度条
 * 使用 Reka UI Slider 实现进度条和音量滑块，Tooltip 实现按钮提示。
 */

import { computed, ref, onMounted, inject } from 'vue'
import { usePlayerStore } from '../stores/player'
import { Icon } from '@iconify/vue'
import { SliderRoot, SliderTrack, SliderRange, SliderThumb, TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow, TooltipProvider, HoverCardRoot, HoverCardTrigger, HoverCardPortal, HoverCardContent } from 'reka-ui'

const player = usePlayerStore()
const muted = ref(false)        // 是否静音
const prevVolume = ref(0.7)     // 静音前的音量
const desktopLyricsOpen = ref(false)
const toggleLyricsOverlay = inject('toggleLyricsOverlay', () => { })

onMounted(() => {
  // 监听桌面歌词可见性变化
  window.electronAPI?.onDesktopLyricsVisibility(v => desktopLyricsOpen.value = v)
  // 监听桌面歌词窗口的播放控制
  window.electronAPI?.onPlayerControl(action => {
    if (action === 'prev') player.prevTrack()
    else if (action === 'next') player.nextTrack()
    else if (action === 'togglePlay') player.togglePlay()
  })
})

/** 打开歌词弹层 */
function openLyricsOverlay() {
  if (player.currentTrack) toggleLyricsOverlay()
}

/** 播放模式图标 */
const modeIcon = computed(() => ['mdi:repeat', 'mdi:shuffle', 'mdi:repeat-once'][player.playMode])
/** 播放模式文字 */
const modeText = computed(() => ['顺序播放', '随机播放', '单曲循环'][player.playMode])
/** 音量图标（三态：静音/中/高） */
const volumeIcon = computed(() => {
  if (muted.value || player.volume === 0) return 'mdi:volume-off'
  if (player.volume < 0.4) return 'mdi:volume-medium'
  return 'mdi:volume-high'
})

/** 切换静音（记忆上次音量） */
function toggleMute() {
  if (muted.value) { player.setVolume(prevVolume.value); muted.value = false }
  else { prevVolume.value = player.volume; player.setVolume(0); muted.value = true }
}

/** 切换桌面歌词窗口 */
function toggleDesktopLyrics() { window.electronAPI?.desktopLyricsToggle() }

/** 格式化秒数为 m:ss */
const formatCurrentTime = computed(() => formatTime(player.currentTime))
const formatDuration = computed(() => formatTime(player.duration))

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
.player-bar {
  display: flex;
  align-items: center;
  height: var(--player-height);
  padding: 0 20px;
  background: rgba(15, 15, 26, 0.95);
  border-top: 1px solid var(--border);
  gap: 20px;
  flex-shrink: 0;
  z-index: 10;
}

.player-track-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 220px;
  max-width: 280px;
}

.player-cover {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  background: var(--bg-tertiary);
}

.player-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition);
}

.player-track-info:hover .player-cover-overlay {
  opacity: 1;
}

.cover-expand-icon {
  font-size: 18px;
  color: #fff;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 22px;
  color: var(--text-muted);
}

.player-meta {
  overflow: hidden;
}

.player-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-author {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.placeholder-text .player-title {
  color: var(--text-muted);
}

.placeholder-text .player-author {
  color: var(--text-muted);
}

.player-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.controls-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ctrl-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}

.ctrl-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.ctrl-btn:disabled {
  opacity: 0.3;
  cursor: default;
  pointer-events: none;
}

.ctrl-btn.active {
  color: var(--accent);
}

.play-btn {
  font-size: 32px;
  color: var(--text-primary);
}

.play-btn:hover {
  color: var(--accent);
  background: var(--accent-dim);
}

.progress-area {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 500px;
}

.time {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 32px;
}

.time.current {
  text-align: right;
}

.time.total {
  text-align: left;
}

.progress-bar {
  flex: 1;
  display: flex;
  align-items: center;
  height: 20px;
  cursor: pointer;
  position: relative;
}

.progress-bar:hover .slider-thumb {
  opacity: 1;
}


</style>
