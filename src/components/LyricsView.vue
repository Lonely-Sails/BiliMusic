<template>
  <div class="lyrics-view">
    <div class="lyrics-header">
      <h2>
        <Icon icon="mdi:microphone" class="section-icon" />
        歌词
      </h2>
      <div class="lyrics-header-right">
        <button
          class="lyrics-edit-btn"
          :class="{ active: player.showTranslation }"
          :title="player.showTranslation ? '隐藏翻译' : '显示翻译'"
          @click="player.toggleTranslation()"
        >
          <Icon icon="mdi:translate" />
          {{ player.showTranslation ? '译' : '译' }}
        </button>
        <button class="lyrics-edit-btn" @click="openLyricsEditor">
          <Icon icon="mdi:playlist-edit" />
          编辑
        </button>
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
            <span class="lyric-line-text">{{ line.text || '♫' }}</span>
            <span
              v-if="player.showTranslation && line.trans"
              class="lyric-line-trans"
              :class="{ 'active-trans': index === activeIndex }"
            >{{ line.trans }}</span>
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
  ScrollAreaRoot, ScrollAreaViewport,
  ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner
} from 'reka-ui'

export default {
  name: 'LyricsView',
  components: {
    Icon,
    ScrollAreaRoot, ScrollAreaViewport,
    ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner
  },
  setup() {
    const player = usePlayerStore()
    const lyricsScrollArea = ref(null)
    let lastActiveIndex = -1

    function openLyricsEditor() {
      if (window.electronAPI?.openLyricsEditor) {
        const track = player.currentTrack
        window.electronAPI.openLyricsEditor(track ? {
          title: track.title || '',
          bvid: track.bvid || '',
          cid: track.cid || ''
        } : null)
      }
    }

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

    return { player, lyricsScrollArea, activeIndex, openLyricsEditor }
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

/* ── 歌词编辑按钮 ── */
.lyrics-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.lyrics-edit-btn:hover {
  background: var(--bg-hover);
  color: var(--accent);
  border-color: var(--accent);
}

.lyrics-edit-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-dim);
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

/* ── 歌词翻译 ── */
.lyric-line-text {
  display: block;
}

.lyric-line-trans {
  display: block;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  opacity: 0.8;
  line-height: 1.5;
  margin-top: 2px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.lyric-line-trans.active-trans {
  color: var(--accent);
  opacity: 0.75;
  font-size: 15px;
  text-shadow: 0 0 12px rgba(251, 114, 153, 0.25);
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
