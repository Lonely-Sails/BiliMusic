<template>
  <div class="lyrics-view">
    <div class="lyrics-header">
      <h2>
        <Icon icon="mdi:microphone" class="section-icon" />
        歌词
      </h2>
      <div class="lyrics-header-right">
        <span v-if="player.lyricCandidates.length <= 1 && player.lyricSource" class="lyrics-source">
          <Icon :icon="sourceIcon" />
          {{ sourceLabel }}
        </span>
        <SelectRoot v-else-if="player.lyricCandidates.length > 1" v-model="selectedSourceValue">
          <SelectTrigger class="lyric-select-trigger">
            <img v-if="selectedCandidate?.cover" :src="selectedCandidate.cover + '@64w_64h'" class="lyric-select-cover" />
            <SelectValue />
            <Icon icon="mdi:chevron-down" class="lyric-select-chevron" />
          </SelectTrigger>
          <SelectPortal>
            <SelectContent class="lyric-select-content" side="bottom" align="end">
              <SelectViewport>
                <SelectItem
                  v-for="c in player.lyricCandidates"
                  :key="c.source + c.id"
                  :value="c.source + '|' + c.id"
                  class="lyric-select-item"
                >
                  <img v-if="c.cover" :src="c.cover + '@64w_64h'" class="lyric-select-cover" />
                  <div class="lyric-select-item-info">
                    <SelectItemText>{{ c.sourceName }}</SelectItemText>
                    <span class="lyric-select-item-song">{{ c.song }}</span>
                  </div>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
      </div>
    </div>

    <div v-if="!player.currentTrack" class="empty-lyrics">
      <Icon icon="mdi:music-note-off" class="empty-icon" />
      <p class="empty-title">暂无播放</p>
      <p class="empty-hint">播放歌曲后将显示歌词</p>
    </div>

    <div v-else-if="player.currentLyrics.length === 0" class="empty-lyrics">
      <Icon icon="mdi:file-document-outline" class="empty-icon" />
      <p class="empty-title">暂无歌词</p>
      <p class="empty-hint">该视频没有可用歌词</p>
    </div>

    <ScrollAreaRoot v-else ref="lyricsScrollArea" class="lyrics-scrollarea">
      <ScrollAreaViewport class="lyrics-scrollarea-viewport">
        <div class="lyrics-list">
          <div
            v-for="(line, index) in player.currentLyrics"
            :key="index"
            class="lyric-line"
            :class="{ active: index === activeIndex }"
          >
            {{ line.text || '♫' }}
          </div>
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar class="lyrics-scrollbar" orientation="vertical">
        <ScrollAreaThumb class="lyrics-scrollthumb" />
      </ScrollAreaScrollbar>
      <ScrollAreaCorner class="lyrics-scrollcorner" />
    </ScrollAreaRoot>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '../stores/player'
import { Icon } from '@iconify/vue'
import {
  SelectRoot, SelectTrigger, SelectValue,
  SelectPortal, SelectContent, SelectViewport,
  SelectItem, SelectItemText,
  ScrollAreaRoot, ScrollAreaViewport,
  ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner
} from 'reka-ui'

const SOURCE_LABELS = {
  subtitle: { label: 'B站字幕', icon: 'mdi:closed-caption' },
  qqmusic: { label: 'QQ音乐', icon: 'mdi:music-note' },
  netease: { label: '网易云音乐', icon: 'mdi:cloud-outline' },
}

export default {
  name: 'LyricsView',
  components: {
    Icon,
    SelectRoot, SelectTrigger, SelectValue,
    SelectPortal, SelectContent, SelectViewport,
    SelectItem, SelectItemText,
    ScrollAreaRoot, ScrollAreaViewport,
    ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner
  },
  setup() {
    const player = usePlayerStore()
    const lyricsScrollArea = ref(null)
    const sourceLabel = ref('')
    const sourceIcon = ref('')
    let lastActiveIndex = -1

    watch(() => player.lyricSource, (val) => {
      const info = SOURCE_LABELS[val]
      sourceLabel.value = info?.label || ''
      sourceIcon.value = info?.icon || ''
    }, { immediate: true })

    const selectedCandidate = computed(() => {
      return player.lyricCandidates.find(c => c.id === player.lyricCandidateId) || player.lyricCandidates[0]
    })

    const selectedSourceValue = computed({
      get: () => {
        const c = selectedCandidate.value
        return c ? `${c.source}|${c.id}` : undefined
      },
      set: (val) => {
        if (!val) return
        const [source, id] = val.split('|')
        player.selectLyricCandidate(source, id)
      }
    })

    const activeIndex = computed(() => {
      const lyrics = player.currentLyrics
      const t = player.currentTime
      for (let i = 0; i < lyrics.length; i++) {
        const line = lyrics[i]
        const nextLine = lyrics[i + 1]
        if (!line) continue
        if (!nextLine) {
          if (t >= line.time) return i
        } else if (t >= line.time && t < nextLine.time) {
          return i
        }
      }
      return -1
    })

    watch(activeIndex, (idx) => {
      if (idx < 0 || idx === lastActiveIndex) return
      lastActiveIndex = idx
      const viewport = lyricsScrollArea.value?.viewport
      if (!viewport) return
      const el = viewport.querySelector(`.lyric-line:nth-child(${idx + 1})`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })

    return { player, lyricsScrollArea, sourceLabel, sourceIcon, selectedCandidate, selectedSourceValue, activeIndex }
  }
}
</script>

<style scoped>
.lyrics-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ── 导航栏式固定头部 ── */
.lyrics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 0 20px;
  height: 48px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(22, 22, 42, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* 底部渐变过渡，替代生硬的 border */
.lyrics-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -20px;
  height: 20px;
  background: linear-gradient(to bottom, rgba(22, 22, 42, 0.85), transparent);
  pointer-events: none;
}

.lyrics-header h2 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.lyrics-header h2 :deep(.section-icon) {
  font-size: 18px;
  color: var(--text-muted);
  margin-right: 0;
}

.lyrics-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── 来源标签 ── */
.lyrics-source {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-card);
  padding: 4px 12px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ── 歌词滚动区 ── */
.lyrics-scrollarea {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.lyrics-scrollarea-viewport {
  height: 100%;
  width: 100%;
}

.lyrics-scrollbar {
  display: flex;
  width: 4px;
  padding: 0;
  z-index: 10;
}

.lyrics-scrollthumb {
  flex: 1;
  background: var(--border);
  border-radius: 2px;
  min-height: 30px;
}

.lyrics-scrollthumb:hover {
  background: var(--text-muted);
}

.lyrics-scrollcorner {
  background: transparent;
}

/* ── 歌词列表 ── */
.lyrics-list {
  padding: 40px 0;
}

.lyric-line {
  padding: 14px 48px;
  text-align: center;
  font-size: 15px;
  color: var(--text-muted);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1.7;
  border-radius: var(--radius-md);
  cursor: default;
}

.lyric-line.active {
  color: var(--accent);
  font-size: 22px;
  font-weight: 700;
  text-shadow: 0 0 20px var(--accent-glow);
}

/* ── 来源选择器 (Reka UI Select) ── */
.lyric-select-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
  outline: none;
  white-space: nowrap;
}

.lyric-select-trigger:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.lyric-select-trigger:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}

.lyric-select-cover {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.lyric-select-chevron {
  font-size: 14px;
  opacity: 0.6;
  transition: transform 0.2s;
}

.lyric-select-trigger[data-state="open"] .lyric-select-chevron {
  transform: rotate(180deg);
}

.lyric-select-item-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.lyric-select-item-song {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

/* ── 空状态 ── */
.empty-lyrics {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  opacity: 0.4;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}
</style>
