<template>
  <div id="app-root">
    <!-- 悬停触发器 -->
    <div class="hover-trigger" @mousedown="onDragStart" />

    <!-- 工具栏 -->
    <Toolbar
      :locked="locked"
      :playing="isPlaying"
      :track-title="trackTitle"
      @toggle-lock="toggleLock"
      @dragstart="onDragStart"
    />

    <!-- 歌词区域 -->
    <div class="lyrics-container" ref="containerRef">
      <div class="empty-text" v-if="!hasTrack">暂无播放</div>
      <div class="empty-text" v-else-if="lyrics.length === 0">暂无歌词</div>
      <div v-else class="lyrics-list" :style="scrollStyle">
        <div
          class="lyric-line"
          v-for="(line, index) in lyrics"
          :key="index"
          :class="{ active: index === activeIdx, next: index === activeIdx + 1 }"
        >
          <span class="lyric-text">{{ line.text || '♫' }}</span>
          <span class="lyric-trans" v-if="line.trans">{{ line.trans }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, watch, onMounted, onUnmounted } from 'vue'
import Toolbar from './components/Toolbar.vue'

/* =========================
   工具
   ========================= */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

/* =========================
   状态 — 使用 shallowRef 避免深层响应式开销
   ========================= */
const lyrics       = shallowRef([])
const currentTime  = ref(0)
const trackTitle   = ref('未在播放')
const hasTrack     = ref(false)
const isPlaying    = ref(false)
const locked       = ref(false)
const containerRef = ref(null)

/* =========================
   自定义拖拽状态
   ========================= */
let isDragging = false
let dragStartX = 0
let dragStartY = 0

/* =========================
   计算属性
   ========================= */
const activeIdx = computed(() => {
  const arr = lyrics.value
  const t   = currentTime.value
  if (!arr.length) return -1
  // 二分查找优化：歌词数组按时间有序
  let lo = 0, hi = arr.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    if (arr[mid].time <= t) lo = mid
    else hi = mid - 1
  }
  return arr[lo] && t >= arr[lo].time ? lo : -1
})

/* =========================
   滚动偏移 — flush:'post' 保证在 DOM 更新后读取，避免 layout thrashing
   ========================= */
const scrollOffset = ref(0)

watch(activeIdx, (idx) => {
  const container = containerRef.value
  if (idx < 0 || !container) {
    scrollOffset.value = 0
    return
  }
  const containerHeight = container.offsetHeight
  const el = container.children[0]?.children[idx]
  if (!el) { scrollOffset.value = 0; return }
  const offset = el.offsetTop + el.offsetHeight - containerHeight / 2 + 20
  scrollOffset.value = offset
}, { flush: 'post' })

const scrollStyle = computed(() => ({
  transform: `translateY(-${scrollOffset.value}px)`
}))

/* =========================
   自动字体大小 — 根据窗口高度计算（resize 时更新）
   ========================= */
function calcFontSize() {
  const container = document.querySelector('.lyrics-container')
  if (!container) return 20
  const h = container.clientHeight
  return clamp(Math.round(h / 5.5), 12, 48)
}

function applyFontSize() {
  const size = calcFontSize()
  document.documentElement.style.setProperty('--lyric-font-size', size + 'px')
}

/* =========================
   自定义窗口拖拽
   ========================= */
function onDragStart(e) {
  if (e.button !== 0) return
  if (locked.value) return
  isDragging = true
  dragStartX = e.screenX
  dragStartY = e.screenY
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  e.preventDefault()
}

function onDragMove(e) {
  if (!isDragging) return
  const dx = e.screenX - dragStartX
  const dy = e.screenY - dragStartY
  dragStartX = e.screenX
  dragStartY = e.screenY
  window.desktopLyricsAPI?.moveWindow(dx, dy)
}

function onDragEnd() {
  isDragging = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

/* =========================
   设置持久化
   ========================= */
function saveSettings() {
  try {
    localStorage.setItem('desktopLyricsSettings', JSON.stringify({
      locked: locked.value,
    }))
  } catch (_) {}
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('desktopLyricsSettings'))
    if (!s) return
    locked.value = s.locked ?? false
  } catch (_) {}
}

/* =========================
   工具栏 — 鼠标进入窗口显示，离开窗口隐藏
   ========================= */
function showToolbar() {
  clearTimeout(toolbarTimer)
  document.body.classList.add('hover')
  if (!locked.value)
    document.body.style.setProperty('--bg-alpha', '0.3')
}

function hideToolbar() {
  clearTimeout(toolbarTimer)
  document.body.classList.remove('hover')
  document.body.style.setProperty('--bg-alpha', '0')
}

let toolbarTimer

/* =========================
   锁定 — 点击穿透
   ========================= */
function toggleLock() {
  locked.value = !locked.value
  applyLockState()
  saveSettings()
}

function applyLockState() {
  document.body.classList.toggle('locked', locked.value)
  if (locked.value) {
    window.desktopLyricsAPI?.setIgnoreEvents(true)
    document.body.style.setProperty('--bg-alpha', '0')
  } else {
    window.desktopLyricsAPI?.setIgnoreEvents(false)
    if (document.body.classList.contains('hover'))
      document.body.style.setProperty('--bg-alpha', '0.3')
  }
}

/* =========================
   IPC 通信
   ========================= */
function setupIPC() {
  const api = window.desktopLyricsAPI
  if (!api) return

  api.onLyricsUpdate(data => {
    const newLyrics = data.lyrics || []
    const newTime   = data.currentTime || 0

    // shallowRef 需要整体替换触发更新
    lyrics.value      = newLyrics
    currentTime.value = newTime
    hasTrack.value    = true
  })

  api.onTimeUpdate(time => currentTime.value = time)

  api.onTrackChange((track) => {
    trackTitle.value = track?.title || '未在播放'
    hasTrack.value   = !!track
  })

  api.onPlayState(playing => isPlaying.value = playing)
}

/* =========================
   键盘快捷键
   ========================= */
function onKeyDown(e) {
  if (e.key === 'Escape' && locked.value) {
    toggleLock()
  }
}

/* =========================
   窗口 resize — 去掉了无意义的 currentTime 自赋值
   ========================= */
function onResize() {
  applyFontSize()
  // 强制重新计算滚动位置（watch flush:'post' 会在 DOM 更新后自动触发）
  scrollOffset.value = 0
}

/* =========================
   生命周期
   ========================= */
onMounted(() => {
  loadSettings()
  setupIPC()
  applyFontSize()
  document.body.style.setProperty('--bg-alpha', '0')
  if (locked.value) applyLockState()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize)

  document.documentElement.addEventListener('mouseenter', showToolbar)
  document.documentElement.addEventListener('mouseleave', hideToolbar)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onResize)
  document.documentElement.removeEventListener('mouseenter', showToolbar)
  document.documentElement.removeEventListener('mouseleave', hideToolbar)
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})
</script>

<style>
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

:root {
  --lyric-font-size: 20px;
  --accent: #fb7299;
  --text: #e8e8f0;
}

html, body {
  width: 100%; height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  background: transparent;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

body {
  display: flex;
  flex-direction: column;
  background: rgba(0,0,0,var(--bg-alpha, 0));
  border-radius: var(--body-radius, 12px);
  padding: var(--body-pad, 4px);
  position: relative;
}

#app-root {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

body.hover {
  box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 0 0 1px rgba(0,0,0,0.25), 0 4px 24px rgba(0,0,0,0.3);
}

.hover-trigger {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 40px;
  z-index: 5;
}

.lyrics-container {
  padding: 8px 16px;
  overflow: hidden;
  z-index: 1;
  flex: 1;
}

.lyrics-list {
  text-align: center;
  width: 100%;
  will-change: transform;
  transition: transform .5s cubic-bezier(0.22, 1, 0.36, 1);
}

.lyric-line {
  padding: 4px 0;
  font-size: var(--lyric-font-size);
  color: rgb(121, 121, 121);
  /* 合并 transition，减少 GPU 合成开销 */
  transition: color 1s, text-shadow 0.7s, font-weight .7s,
              transform 1s cubic-bezier(0.22, 1, 0.36, 1),
              opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  transform: translateY(20px);
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 100%;
  opacity: 0;
}

.lyric-text { display: block; }

.lyric-trans {
  display: block;
  font-size: 0.65em;
  font-weight: 400;
  line-height: 1.3;
  transition: color 1s, text-shadow 0.7s;
}

.lyric-line.active .lyric-trans {
  font-weight: 600;
  color: rgba(251,114,153,0.8);
}

.lyric-line.next, .lyric-line.active {
  opacity: 1;
  transform: translateY(0);
}

.lyric-line.next {
  transition: transform 1.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.lyric-line.active {
  color: var(--accent);
  font-weight: 700;
  transform: scale(1.1);
  text-shadow: 0 0 12px rgba(251,114,153,0.5), 0 0 24px rgba(251,114,153,0.15);
}

.empty-text {
  color: rgba(232,232,240,0.6);
  font-size: 28px;
  font-weight: 600;
  text-align: center;
  letter-spacing: 2px;
  text-shadow: 0 2px 16px rgba(0,0,0,0.5);
  line-height: 2.5;
}
</style>