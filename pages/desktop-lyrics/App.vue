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
      @prev="prevTrack"
      @next="nextTrack"
      @toggle-play="togglePlay"
      @close="closeWindow"
      @dragstart="onDragStart"
      @lock-enter="onLockEnter"
      @lock-leave="onLockLeave"
    />

    <!-- 歌词区域 -->
    <div class="lyrics-container">
      <div class="empty-text" v-if="!hasTrack">暂无播放</div>
      <div class="empty-text" v-else-if="lyrics.length === 0">暂无歌词</div>
      <div class="lyrics-list" v-else ref="listRef">
        <div class="lyric-line" />
        <div class="lyric-line" />
        <div class="lyric-line" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Toolbar from './components/Toolbar.vue'

/* =========================
   工具
   ========================= */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

/* =========================
   状态
   ========================= */
const lyrics       = ref([])
const currentTime  = ref(0)
const trackTitle   = ref('未在播放')
const hasTrack     = ref(false)
const isPlaying    = ref(false)
const locked       = ref(false)
const listRef      = ref(null)

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
  for (let i = 0; i < arr.length; i++) {
    const cur = arr[i]
    const nxt = arr[i + 1]
    if (!cur) continue
    if (!nxt) { if (t >= cur.time) return i }
    else if (t >= cur.time && t < nxt.time) return i
  }
  return -1
})

/* =========================
   自动字体大小 — 根据窗口高度计算
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
let toolbarTimer

function showToolbar() {
  clearTimeout(toolbarTimer)
  document.body.classList.add('hover')
  // 锁定状态不显示背景
  if (!locked.value) {
    document.body.style.setProperty('--bg-alpha', '0.3')
  }
}

function hideToolbar() {
  clearTimeout(toolbarTimer)
  document.body.classList.remove('hover')
  document.body.style.setProperty('--bg-alpha', '0')
}

function onToolbarEnter() { showToolbar() }
function onToolbarLeave() { hideToolbar() }

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
    if (document.body.classList.contains('hover')) {
      document.body.style.setProperty('--bg-alpha', '0.3')
    }
  }
}

/* 锁定状态下悬浮解锁按钮时取消穿透，离开恢复 */
function onLockEnter() {
  if (locked.value) {
    window.desktopLyricsAPI?.setIgnoreEvents(false)
  }
}

function onLockLeave() {
  if (locked.value) {
    window.desktopLyricsAPI?.setIgnoreEvents(true)
  }
}

function closeWindow() {
  window.desktopLyricsAPI?.hide()
}

function prevTrack() {
  window.desktopLyricsAPI?.prevTrack()
}

function nextTrack() {
  window.desktopLyricsAPI?.nextTrack()
}

function togglePlay() {
  window.desktopLyricsAPI?.togglePlay()
}

/* =========================
   IPC 通信
   ========================= */
function setupIPC() {
  const api = window.desktopLyricsAPI
  if (!api) return

  api.onLyricsUpdate((data) => {
    const newLyrics = data.lyrics || []
    const newTime   = data.currentTime || 0

    // 检测是否切歌（歌词长度变化或第一句文字变化）
    // const isNewSong = newLyrics.length !== lyrics.value.length ||
    //   (newLyrics.length > 0 && lyrics.value.length > 0 &&
    //     newLyrics[0].text !== lyrics.value[0]?.text)

    // if (isNewSong) resetSlots()

    lyrics.value      = newLyrics
    currentTime.value = newTime
    hasTrack.value    = true
  })

  api.onTimeUpdate((time) => {
    currentTime.value = time
  })

  api.onTrackChange((track) => {
    trackTitle.value = track?.title || '未在播放'
    hasTrack.value   = !!track
  })

  api.onPlayState((playing) => {
    isPlaying.value = playing
  })
}

/* =========================
   键盘快捷键
   ========================= */
function onKeyDown(e) {
  if (e.key === 'Escape' && locked.value) {
    toggleLock()
  }
}

/** 重置状态 */
function resetSlots(startIdx) {
  const list = listRef.value
  const arr = lyrics.value
  if (!list || !arr.length || list.children.length < 3) return

  for (const child of list.children) {
    child.style = ''
    child.className = 'lyric-line'
    child.getAnimations().forEach(a => a.cancel())
  }

  const idx0 = startIdx
  const idx1 = startIdx + 1
  const idx2 = startIdx + 2

  const ch = list.children
  ch[0].textContent = arr[idx0]?.text || '♫'
  ch[1].textContent = idx1 < arr.length ? (arr[idx1]?.text || '♫') : ''
  ch[2].textContent = idx2 < arr.length ? (arr[idx2]?.text || '♫') : ''
}

watch(activeIdx, (newIdx, oldIdx) => {
  nextTick(async () => {
    const list = listRef.value
    const arr = lyrics.value
    if (!list || newIdx < 0 || !arr.length || list.children.length < 3) return

    const ch = list.children

    const activeEl  = ch[0]
    const nextEl    = ch[1]
    const standbyEl = ch[2]

    if (newIdx !== oldIdx + 1) {
      // ── 初始化（切歌/拖动进度/切换歌词） ──
      resetSlots(newIdx)

      activeEl.className = 'lyric-line active'
      nextEl.className = 'lyric-line next'
      standbyEl.className = 'lyric-line standby'

      return
    }

    const fontSize = calcFontSize()

    // 取消所有正在运行的动画和 onfinish 回调，防止旧动画干扰
    resetSlots(newIdx - 1)

    // ── 旧 active：向上淡出 ──
    activeEl.style = ''
    activeEl.className = 'lyric-line standby'
    const activeAnimation = activeEl.animate([
      { opacity: '1', transform: 'translateY(0)' },
      { opacity: '0', transform: `translateY(-${fontSize}px)` },
    ], { duration: 600, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' })
    activeAnimation.onfinish = () => {
      // ── 回收旧 active → 移至底部，作为新 standby ──
      const standbyIdx = newIdx + 2
      activeEl.textContent = standbyIdx < arr.length ? (arr[standbyIdx]?.text || '♫') : ''
      activeEl.style.position = ''
      activeEl.className = 'lyric-line standby'
      list.appendChild(activeEl)
    }
    activeEl.style.position = 'absolute'
    // 设置偏移保持重拍后位置不变
    nextEl.style.transform = `translateY(${fontSize}px)`
    standbyEl.style.transform = `translateY(${fontSize}px)`

    // ── 原 next → 新 active ──
    nextEl.className = 'lyric-line active'
    const nextAnimation = nextEl.animate([
      { opacity: '0', transform: `translateY(${fontSize}px)` },
      { opacity: '1', transform: 'translateY(0)' },
    ], { duration: 700, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' })
    nextAnimation.onfinish = () => nextEl.style = ''

    // ── 原 standby → 新 next，从下淡入 ──
    // standbyEl.textContent = arr[standbyIdx]?.text || '♫'
    standbyEl.className = 'lyric-line next'
    // standbyEl.getAnimations().forEach(a => a.cancel())
    const standbyAnimation = standbyEl.animate([
      { opacity: '0', transform: `translateY(${fontSize}px)` },
      { opacity: '1', transform: 'translateY(0)' },
    ], { duration: 1000, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' })
    standbyAnimation.onfinish = () => standbyEl.style = ''
  })
})

/* =========================
   窗口 resize
   ========================= */
function onResize() {
  applyFontSize()
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
  // 清理拖拽状态
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})
</script>

<style>
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

:root {
  --lyric-font-size: 20px;
  --toolbar-h: 32px;
  --body-radius: 12px;
  --body-pad: 4px;
  --accent: #fb7299;
  --text: #e8e8f0;
  --text-dim: #9494b8;
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
  border-radius: var(--body-radius);
  padding: var(--body-pad);
  position: relative;
}

#app-root {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ===========================
   工具栏 — 可见性由 body.hover 控制
   =========================== */
.desktop-toolbar {
  flex-shrink: 0;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}
body.hover .desktop-toolbar { visibility: visible; opacity: 1; }

body.hover {
  box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 0 0 1px rgba(0,0,0,0.25), 0 4px 24px rgba(0,0,0,0.3);
}

body.locked .desktop-toolbar { display: flex; }

/* 悬停触发条 – 覆盖窗口顶部区域 */
.hover-trigger {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 40px;
  z-index: 5;
}



/* ===========================
   歌词容器
   =========================== */
.lyrics-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 8px 16px;
  overflow: hidden;
  z-index: 1;
  flex: 1;
}

.lyrics-list {
  text-align: center;
  width: 100%;
  will-change: transform;
}

.lyric-line {
  padding: 4px 0;
  font-size: var(--lyric-font-size);
  color: rgba(232,232,240,0.4);
  transition: color 0.7s cubic-bezier(0.22,1,0.36,1),
              text-shadow 0.7s cubic-bezier(0.22,1,0.36,1),
              font-size 0.7s cubic-bezier(0.22,1,0.36,1);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  will-change: transform, opacity;
  width: 100%;
}

.lyric-line.active {
  color: var(--accent);
  font-weight: 700;
  font-size: calc(var(--lyric-font-size) * 1.1);
  text-shadow: 0 0 24px rgba(251,114,153,0.5), 0 0 48px rgba(251,114,153,0.15);
}
.lyric-line.next { color: rgba(232,232,240,0.45); }
.lyric-line.standby { opacity: 0; }

.empty-text {
  color: rgba(232,232,240,0.6);
  font-size: 28px;
  font-weight: 600;
  text-align: center;
  letter-spacing: 2px;
  text-shadow: 0 2px 16px rgba(0,0,0,0.5);
}
</style>
