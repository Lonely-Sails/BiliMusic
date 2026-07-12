<template>
  <Teleport to="body">
    <Transition name="lyrics-overlay">
      <div
        v-if="visible"
        class="lyrics-overlay"
        @click.self="close"
      >
        <!-- 模糊背景层 -->
        <div class="lyrics-bg" :style="bgStyle"></div>
        <div class="lyrics-bg-scrim"></div>

        <!-- 主体：左右结构 -->
        <div class="lyrics-body" @click.stop>

          <!-- === 左侧：封面 + 控制 === -->
          <div class="lyrics-left">
            <!-- 关闭按钮 -->
            <button class="lo-close" @click="close">
              <Icon icon="mdi:chevron-down" />
            </button>

            <!-- 大封面 -->
            <div class="lo-cover-wrap" v-if="player.currentTrack">
              <img
                class="lo-cover"
                :src="player.currentTrack.cover + '@256w_256h.webp'"
                :alt="player.currentTrack.title"
              />
            </div>
            <div class="lo-cover-wrap placeholder" v-else>
              <Icon icon="mdi:music-note" class="lo-cover-placeholder-icon" />
            </div>

            <!-- 歌曲名 & 作者 -->
            <div class="lo-meta" v-if="player.currentTrack">
              <div class="lo-title">{{ player.currentTrack.title }}</div>
              <div class="lo-author">{{ player.currentTrack.author || '未知' }}</div>
            </div>
            <div class="lo-meta" v-else>
              <div class="lo-title lo-title-muted">未在播放</div>
              <div class="lo-author lo-author-muted">播放歌曲后将显示歌词</div>
            </div>

            <!-- 播放控制 -->
            <div class="lo-controls" v-if="player.currentTrack">
              <button class="lo-ctrl-btn" @click="player.prevTrack()">
                <Icon icon="mdi:skip-previous" />
              </button>
              <button class="lo-ctrl-btn lo-play-btn" @click="player.togglePlay()">
                <Icon :icon="player.isPlaying ? 'mdi:pause' : 'mdi-play'" />
              </button>
              <button class="lo-ctrl-btn" @click="player.nextTrack()">
                <Icon icon="mdi:skip-next" />
              </button>
            </div>

            <!-- 歌词时间轴偏移（直接修改歌词时间戳） -->
            <div class="lo-offset" v-if="player.currentLyrics.length > 0">
              <button class="lo-offset-btn" @click="shiftLyrics(-1)" title="歌词时间提前1秒">
                <Icon icon="mdi:minus" />
              </button>
              <span class="lo-offset-label">歌词时间</span>
              <button class="lo-offset-btn" @click="shiftLyrics(1)" title="歌词时间推迟1秒">
                <Icon icon="mdi:plus" />
              </button>
            </div>

            <!-- 工具栏 -->
            <div class="lo-tools">
              <button
                class="lo-tool-btn"
                :class="{ active: player.showTranslation }"
                @click="player.toggleTranslation()"
              >
                <Icon icon="mdi:translate" />
              </button>
              <button class="lo-tool-btn" @click="openLyricsEditor">
                <Icon icon="mdi:playlist-edit" />
              </button>
            </div>
          </div>

          <!-- === 右侧：歌词 === -->
          <div class="lyrics-right">
            <div v-if="!player.currentTrack" class="lo-empty">
              <Icon icon="mdi:music-note-off" class="lo-empty-icon" />
              <p class="lo-empty-title">暂无播放</p>
            </div>
            <div v-else-if="player.currentLyrics.length === 0" class="lo-empty">
              <Icon icon="mdi:file-document-outline" class="lo-empty-icon" />
              <p class="lo-empty-title">暂无歌词</p>
              <p class="lo-empty-hint">该视频没有可用歌词</p>
            </div>
            <div v-else ref="lyricsContainer" class="lo-lyrics-scroll">
              <div class="lo-lyrics-list">
                <div
                  v-for="(line, index) in player.currentLyrics"
                  :key="index"
                  class="lo-line"
                  :class="{ active: index === activeIndex }"
                >
                  <span class="lo-line-text">{{ line.text || '♫' }}</span>
                  <span
                    v-if="player.showTranslation && line.trans"
                    class="lo-line-trans"
                    :class="{ 'active-trans': index === activeIndex }"
                  >{{ line.trans }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlayerStore } from '../stores/player'
import { Icon } from '@iconify/vue'

export default {
  name: 'LyricsOverlay',
  components: { Icon },
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const player = usePlayerStore()
    const lyricsContainer = ref(null)
    let lastActiveIndex = -1
    let scrollTicking = false

    const bgStyle = computed(() => {
      if (player.currentTrack?.cover) {
        return {
          backgroundImage: `url(${player.currentTrack.cover}@512w_512h.webp)`
        }
      }
      return {}
    })

    function close() {
      emit('close')
    }

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

    async function shiftLyrics(seconds) {
      const lyrics = player.currentLyrics
      const track = player.currentTrack
      if (!lyrics.length || !track) return

      // 1. 偏移时间戳
      const shifted = lyrics.map(l => ({
        ...l,
        time: Math.max(0, Math.round((l.time + seconds) * 10) / 10)
      }))
      player.currentLyrics = shifted

      // 2. 保存为本地 LRC 文件（和编辑歌词保存完全一致）
      try {
        // 使用原始文件名保存，没有就用标题生成
        let fileName = player.lyricFileName
        if (!fileName) {
          const safeName = track.title.replace(/[\\/:*?"<>|]/g, '_')
          fileName = safeName + '.lrc'
        }
        if (window.electronAPI?.saveLocalLyric) {
          const content = serializeLRC(shifted, track.title, player.lyricSource || '', track.bvid || '')
          await window.electronAPI.saveLocalLyric(fileName, content)
        }
      } catch (e) {
        console.error('Failed to save shifted lyrics:', e)
      }
    }

    // 将歌词行数组序列化为 LRC 文本（与 lyrics-editor 保持一致）
    function serializeLRC(lines, songName, sourceName, bvid) {
      const header = [
        `[ti:${songName}]`,
        '[ar:]',
        bvid ? `[bvid:${bvid}]` : '',
        '[by:BiliMusic]',
        `[source:${sourceName}]`,
        '[re:本歌词来源自网络搜索，仅供个人学习交流使用，请勿用于商业用途]',
        ''
      ].filter(Boolean)

      function fmtTime(time) {
        const m = Math.floor(time / 60)
        const s = Math.floor(time % 60)
        const ms = Math.floor((time % 1) * 100)
        return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`
      }

      const body = []
      for (const l of lines) {
        body.push(`${fmtTime(l.time)}${l.text}`)
        if (l.trans) {
          body.push(`${fmtTime(l.time)}${l.trans}`)
        }
      }
      return [...header, ...body].join('\n')
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

    // 手动控制 smooth scroll（只滚动歌词容器，不影响其他区域）
    function smoothScrollTo(container, targetTop) {
      const start = container.scrollTop
      const diff = targetTop - start
      const duration = 400
      let startTime = null

      function step(timestamp) {
        if (!startTime) startTime = timestamp
        const elapsed = timestamp - startTime
        const progress = Math.min(elapsed / duration, 1)
        // easeInOutCubic
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2
        container.scrollTop = start + diff * ease
        if (progress < 1) {
          requestAnimationFrame(step)
        }
      }
      requestAnimationFrame(step)
    }

    watch(activeIndex, (idx) => {
      if (idx < 0 || idx === lastActiveIndex) return
      lastActiveIndex = idx
      const container = lyricsContainer.value
      if (!container) return
      // 用 requestAnimationFrame 节流，避免快速切换时冲突
      if (scrollTicking) return
      scrollTicking = true
      requestAnimationFrame(() => {
        scrollTicking = false
        const el = container.querySelector(`.lo-line:nth-child(${idx + 1})`)
        if (!el) return
        const containerRect = container.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const offset = el.offsetTop - container.offsetTop
        const target = offset - (containerRect.height / 2) + (elRect.height / 2)
        smoothScrollTo(container, Math.max(0, target))
      })
    })

    // ESC 键关闭
    function onKeydown(e) {
      if (e.key === 'Escape' && props.visible) {
        close()
      }
    }

    // 歌词变更时重置滚动状态
    watch(() => player.currentLyrics, () => {
      lastActiveIndex = -1
      if (lyricsContainer.value) {
        lyricsContainer.value.scrollTop = 0
      }
    })

    // 编辑器保存后即时刷新歌词
    function onEditorSaved() {
      player.clearLyricCache()
      const track = player.currentTrack
      if (track?.bvid) {
        player.loadLyrics(track.bvid, track.cid || '', track.title)
      }
    }

    onMounted(() => {
      document.addEventListener('keydown', onKeydown)
      if (window.electronAPI?.onLyricsEditorSaved) {
        window.electronAPI.onLyricsEditorSaved(onEditorSaved)
      }
    })

    onUnmounted(() => {
      document.removeEventListener('keydown', onKeydown)
      if (window.electronAPI?.removeLyricsEditorSaved) {
        window.electronAPI.removeLyricsEditorSaved(onEditorSaved)
      }
    })

    return { player, lyricsContainer, bgStyle, activeIndex, close, openLyricsEditor, shiftLyrics }
  }
}
</script>

<style scoped>
/* ── 遮罩层容器 ── */
.lyrics-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ── 模糊背景：图片层 ── */
.lyrics-bg {
  position: absolute;
  inset: -60px;
  z-index: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(40px) saturate(1.2);
  transform: scale(1.1);
  transition: background-image 0.6s ease;
}

/* ── 模糊背景：半透明遮罩 ── */
.lyrics-bg-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    135deg,
    rgba(10, 10, 20, 0.60) 0%,
    rgba(10, 10, 20, 0.35) 50%,
    rgba(10, 10, 20, 0.55) 100%
  );
}

/* ════════════════════════════════
   左右主体布局
   ════════════════════════════════ */
.lyrics-body {
  position: relative;
  z-index: 2;
  display: flex;
  width: 100%;
  max-width: 900px;
  height: 100%;
  gap: 0;
}

/* ═══ 左侧：封面 + 控制 ═══ */
.lyrics-left {
  position: relative;
  flex-shrink: 0;
  width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
}

/* ── 内部弹性间距让各区块均匀分布 ── */
.lyrics-left > * + * {
  margin-top: 0;
}

.lyrics-left > .lo-cover-wrap { margin-bottom: 28px; }
.lyrics-left > .lo-meta { margin-bottom: 24px; }
.lyrics-left > .lo-controls { margin-bottom: 10px; }
.lyrics-left > .lo-offset { margin-bottom: 20px; }

/* ── 关闭按钮 ── */
.lo-close {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
  width: 44px;
  height: 30px;
  border-radius: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.lo-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.95);
}

/* ── 大封面 ── */
.lo-cover-wrap {
  width: 200px;
  height: 200px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  background: rgba(255, 255, 255, 0.04);
}

.lo-cover-wrap.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.lo-cover-placeholder-icon {
  font-size: 64px;
  color: rgba(255, 255, 255, 0.15);
}

.lo-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── 歌曲信息 ── */
.lo-meta {
  text-align: center;
  max-width: 260px;
}

.lo-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lo-title-muted {
  color: rgba(255, 255, 255, 0.35);
}

.lo-author {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lo-author-muted {
  color: rgba(255, 255, 255, 0.25);
}

/* ── 播放控制按钮 ── */
.lo-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 上一首 / 下一首：无边框简洁样式 */
.lo-ctrl-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.lo-ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}

.lo-play-btn {
  width: 56px;
  height: 56px;
  font-size: 28px;
  background: var(--accent);
  color: #fff;
  border: none;
  box-shadow: 0 4px 24px rgba(251, 114, 153, 0.35);
}

.lo-play-btn:hover {
  background: var(--accent-hover);
  color: #fff;
  box-shadow: 0 6px 28px rgba(251, 114, 153, 0.45);
}

/* ── 歌词时间轴偏移 ── */
.lo-offset {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lo-offset-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  font-size: 14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.lo-offset-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.20);
}

.lo-offset-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  user-select: none;
  white-space: nowrap;
}

/* ── 工具栏 ── */
.lo-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lo-tool-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 18px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.lo-tool-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
}

.lo-tool-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(251, 114, 153, 0.15);
}

/* ═══ 右侧：歌词 ═══ */
.lyrics-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 80px 0;
}

/* ── 歌词滚动容器 ── */
.lo-lyrics-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 48px 60px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.lo-lyrics-scroll::-webkit-scrollbar {
  width: 3px;
}

.lo-lyrics-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.lo-lyrics-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

/* ── 歌词列表 ── */
.lo-lyrics-list {
  padding: 0;
}

.lo-line {
  padding: 14px 0;
  text-align: left;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.35);
  transition: all 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1.8;
  cursor: default;
}

.lo-line.active {
  color: #fff;
  font-size: 21px;
  font-weight: 700;
  text-shadow: 0 0 24px rgba(255, 255, 255, 0.12);
}

.lo-line-text {
  display: block;
}

.lo-line-trans {
  display: block;
  font-size: 13px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.5;
  margin-top: 2px;
  transition: all 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.lo-line-trans.active-trans {
  color: var(--accent);
  font-size: 15px;
  text-shadow: 0 0 12px rgba(251, 114, 153, 0.2);
}

/* ── 空状态 ── */
.lo-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.35);
}

.lo-empty-icon {
  font-size: 48px;
  opacity: 0.35;
}

.lo-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
}

.lo-empty-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.3);
}

/* ════════════════════════════════
   滑入/滑出动画
   ════════════════════════════════ */
.lyrics-overlay-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.lyrics-overlay-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.lyrics-overlay-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.lyrics-overlay-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.lyrics-overlay-enter-to,
.lyrics-overlay-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
