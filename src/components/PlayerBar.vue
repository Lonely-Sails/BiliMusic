<template>
  <div class="player-bar">
    <!-- Track Info -->
    <div class="player-track-info" @click="openLyricsOverlay" :style="{ cursor: player.currentTrack ? 'pointer' : 'default' }" :title="player.currentTrack ? '点击打开歌词' : ''">
      <div class="player-cover" v-if="player.currentTrack">
        <img :src="player.currentTrack.cover + '@96w_96h.webp'" :alt="player.currentTrack.title" />
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

    <!-- Controls -->
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
              <button
                class="ctrl-btn play-btn"
                @click="player.togglePlay()"
                :disabled="!player.currentTrack"
              >
                <Icon :icon="player.isPlaying ? 'mdi:pause' : 'mdi-play'" />
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

          <TooltipRoot>
            <TooltipTrigger as-child>
              <button class="ctrl-btn" @click="openLyricsOverlay" :disabled="!player.currentTrack">
                <Icon icon="mdi:microphone" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                歌词
                <TooltipArrow class="tooltip-arrow" />
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

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

      <!-- Progress -->
      <div class="progress-area">
        <span class="time current">{{ formatTime(player.currentTime) }}</span>
        <SliderRoot
          class="progress-bar"
          :model-value="[player.currentTime]"
          :max="player.duration || 100"
          :step="1"
          :disabled="!player.currentTrack"
          @update:model-value="([val]) => player.seek(val)"
        >
          <SliderTrack class="slider-track">
            <SliderRange class="slider-range" />
          </SliderTrack>
          <SliderThumb class="slider-thumb" />
        </SliderRoot>
        <span class="time total">{{ formatTime(player.duration) }}</span>
      </div>
    </div>

    <!-- Volume -->
    <div class="player-volume">
      <button class="ctrl-btn" @click="toggleMute">
        <Icon :icon="volumeIcon" />
      </button>
      <SliderRoot
        class="volume-slider"
        :model-value="[muted ? 0 : player.volume]"
        :max="1"
        :step="0.01"
        @update:model-value="([val]) => { player.setVolume(val); muted = false }"
      >
        <SliderTrack class="slider-track volume-track">
          <SliderRange class="slider-range volume-range" />
        </SliderTrack>
        <SliderThumb class="slider-thumb volume-thumb" />
      </SliderRoot>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, inject } from 'vue'
import { usePlayerStore } from '../stores/player'
import { Icon } from '@iconify/vue'
import {
  SliderRoot, SliderTrack, SliderRange, SliderThumb,
  TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow,
  TooltipProvider
} from 'reka-ui'

export default {
  name: 'PlayerBar',
  components: {
    Icon,
    SliderRoot, SliderTrack, SliderRange, SliderThumb,
    TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow,
    TooltipProvider
  },
  setup() {
    const player = usePlayerStore()
    const muted = ref(false)
    const prevVolume = ref(0.7)
    const desktopLyricsOpen = ref(false)
    const toggleLyricsOverlay = inject('toggleLyricsOverlay', () => {})

    // 监听桌面歌词窗口可见性变化，同步状态
    onMounted(() => {
      if (window.electronAPI?.onDesktopLyricsVisibility) {
        window.electronAPI.onDesktopLyricsVisibility((visible) => {
          desktopLyricsOpen.value = visible
        })
      }
      if (window.electronAPI?.onPlayerControl) {
        window.electronAPI.onPlayerControl((action) => {
          if (action === 'prev') player.prevTrack()
          else if (action === 'next') player.nextTrack()
          else if (action === 'togglePlay') player.togglePlay()
        })
      }
    })

    function openLyricsOverlay() {
      if (player.currentTrack) {
        toggleLyricsOverlay()
      }
    }

    const modeIcon = computed(() => {
      return ['mdi:repeat', 'mdi:shuffle', 'mdi:repeat-once'][player.playMode]
    })

    const modeText = computed(() => {
      return ['顺序播放', '随机播放', '单曲循环'][player.playMode]
    })

    const volumeIcon = computed(() => {
      if (muted.value || player.volume === 0) return 'mdi:volume-off'
      if (player.volume < 0.4) return 'mdi:volume-medium'
      return 'mdi:volume-high'
    })

    function toggleMute() {
      if (muted.value) {
        player.setVolume(prevVolume.value)
        muted.value = false
      } else {
        prevVolume.value = player.volume
        player.setVolume(0)
        muted.value = true
      }
    }

    function toggleDesktopLyrics() {
      if (window.electronAPI) {
        window.electronAPI.desktopLyricsToggle()
      }
    }

    function formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00'
      const m = Math.floor(seconds / 60)
      const s = Math.floor(seconds % 60)
      return `${m}:${String(s).padStart(2, '0')}`
    }

    return { player, muted, desktopLyricsOpen, modeIcon, modeText, volumeIcon, toggleMute, toggleDesktopLyrics, formatTime, openLyricsOverlay }
  }
}
</script>
