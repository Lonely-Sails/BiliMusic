<template>
  <Teleport to="body">
    <Transition name="lyrics-overlay">
      <div v-show="visible" class="lyrics-overlay" @click.self="close">
        <div class="lyrics-bg" :style="bgStyle" />
        <div class="lyrics-bg-scrim" />
        <div class="lyrics-body" @click.stop>
          <div class="lyrics-left">
            <button class="close" @click="close">
              <Icon icon="mdi:chevron-down" />
            </button>
            <div v-if="player.currentTrack" class="cover-wrap">
              <img
                class="cover"
                :src="player.currentTrack.cover + '@512w_512h.webp'"
                :alt="player.currentTrack.title"
              />
            </div>
            <div v-else class="cover-wrap placeholder">
              <Icon icon="mdi:music-note" class="cover-placeholder-icon" />
            </div>
            <div v-if="player.currentTrack" class="meta">
              <div class="title">{{ player.currentTrack.title }}</div>
              <div class="author">{{ player.currentTrack.author || '未知' }}</div>
            </div>
            <div v-else class="meta">
              <div class="title title-muted">未在播放</div>
              <div class="author author-muted">播放歌曲后将显示歌词</div>
            </div>
            <div v-if="player.currentTrack" class="controls">
              <button class="ctrl-btn" @click="player.prevTrack()">
                <Icon icon="mdi:skip-previous" />
              </button>
              <button class="ctrl-btn play-btn" @click="player.togglePlay()">
                <Icon :icon="player.isPlaying ? 'mdi:pause' : 'mdi:play'" />
              </button>
              <button class="ctrl-btn" @click="player.nextTrack()">
                <Icon icon="mdi:skip-next" />
              </button>
            </div>
            <div class="tools">
              <button
                class="tool-btn"
                :class="{ active: player.showTranslation }"
                title="显示翻译"
                @click="player.toggleTranslation()"
              >
                <Icon icon="mdi:translate" />
              </button>
              <button class="tool-btn" title="编辑歌词" @click="openLyricsEditor">
                <Icon icon="mdi:playlist-edit" />
              </button>
              <span class="tools-divider" />
              <button
                class="tool-btn"
                title="歌词提前1秒"
                :disabled="!player.currentLyrics.length"
                @click="shiftLyrics(-1)"
              >
                <Icon icon="mdi:clock-minus" />
              </button>
              <button
                class="tool-btn"
                title="歌词推迟1秒"
                :disabled="!player.currentLyrics.length"
                @click="shiftLyrics(1)"
              >
                <Icon icon="mdi:clock-plus" />
              </button>
            </div>
          </div>
          <div class="lyrics-right">
            <div v-if="!player.currentTrack" class="empty">
              <Icon icon="mdi:music-note-off" class="empty-icon" />
              <p class="empty-title">暂无播放</p>
            </div>
            <div v-else-if="!player.currentLyrics.length" class="empty">
              <Icon icon="mdi:file-document-outline" class="empty-icon" />
              <p class="empty-title">暂无歌词</p>
              <p class="empty-hint">该视频没有可用歌词</p>
            </div>
            <div v-else ref="lyricsContainer" class="lyrics-scroll" @scroll="onUserScroll">
              <div class="lyrics-list">
                <div
                  v-for="(line, index) in player.currentLyrics"
                  :key="index"
                  :ref="(el) => setLineRef(index, el)"
                  class="line"
                  :class="{ active: index === activeIndex }"
                  @click="player.seek(line.time)"
                >
                  <span class="line-text">{{ line.text || '♫' }}</span>
                  <span
                    v-if="player.showTranslation && line.trans"
                    class="line-trans"
                    :class="{ 'active-trans': index === activeIndex }"
                    >{{ line.trans }}</span
                  >
                  <span class="line-time">{{ formatLineTime(line.time) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePlayerStore } from '../stores/player';
import { Icon } from '@iconify/vue';

const props = defineProps({ visible: { type: Boolean, default: false } });
const emit = defineEmits(['close']);

const player = usePlayerStore();
const lyricsContainer = ref(null);
let lastActiveIndex = -1;
// 缓存每行歌词的 DOM 元素，避免 scrollToActive 反复 querySelector
const lineElements = new Map();
let scrollRaf = null;
// 用户手动滚动后，暂停自动跟随；5s 无操作后恢复
let userScrollTimer = null;
// 是否允许自动跟随滚动（用户滚动时置 false）
let autoFollow = true;

/** 格式化秒数为 m:ss */
function formatLineTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 用户滚动歌词时暂停自动跟随，5s 无操作后恢复 */
function onUserScroll() {
  autoFollow = false;
  if (userScrollTimer) clearTimeout(userScrollTimer);
  userScrollTimer = setTimeout(() => {
    autoFollow = true;
    scrollToActive(lastActiveIndex);
  }, 5000);
}

function setLineRef(index, el) {
  if (el) lineElements.set(index, el);
  else lineElements.delete(index);
}

const bgStyle = computed(() => {
  if (player.currentTrack?.cover)
    return { backgroundImage: `url(${player.currentTrack.cover}@128w_128h.webp)` };
  return {};
});

function close() {
  emit('close');
}

function openLyricsEditor() {
  if (window.electronAPI?.openLyricsEditor) {
    const track = player.currentTrack;
    window.electronAPI.openLyricsEditor(
      track ? { title: track.title || '', bvid: track.bvid || '', cid: track.cid || '' } : null
    );
  }
}

async function shiftLyrics(seconds) {
  const lyrics = player.currentLyrics;
  const track = player.currentTrack;
  if (!lyrics.length || !track) return;
  const shifted = lyrics.map((line) => ({
    ...line,
    time: Math.max(0, Math.round((line.time + seconds) * 10) / 10),
  }));
  player.currentLyrics = shifted;
  try {
    let fileName = player.lyricFileName;
    if (!fileName) fileName = track.title.replace(/[\\/:*?"<>|]/g, '_') + '.lrc';
    if (window.electronAPI?.saveLocalLyric) {
      const content = serializeLRC(
        shifted,
        track.title,
        player.lyricSource || '',
        track.bvid || ''
      );
      await window.electronAPI.saveLocalLyric(fileName, content);
    }
  } catch (error) {
    console.error('[BiliMusic] Shift lyrics save failed:', error);
  }
}

function serializeLRC(lines, songName, sourceName, bvid) {
  const header = [
    `[ti:${songName}]`,
    '[ar:]',
    bvid ? `[bvid:${bvid}]` : '',
    '[by:BiliMusic]',
    `[source:${sourceName}]`,
    '[re:本歌词来源自网络搜索，仅供个人学习交流使用]',
    '',
  ].filter(Boolean);
  function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}]`;
  }
  const body = [];
  for (const line of lines) {
    body.push(`${formatTime(line.time)}${line.text}`);
    if (line.trans) body.push(`${formatTime(line.time)}${line.trans}`);
  }
  return [...header, ...body].join('\n');
}

const activeIndex = computed(() => {
  // overlay 不可见时无需计算/高亮，直接返回 -1，避免随 currentTime 高频重算
  if (!props.visible) return -1;
  const lyrics = player.currentLyrics;
  const currentTime = player.currentTime;
  if (!lyrics.length) return -1;
  let start = lastActiveIndex >= 0 && lastActiveIndex < lyrics.length ? lastActiveIndex : 0;
  if (start > 0 && currentTime < lyrics[start].time) {
    for (let index = start - 1; index >= 0; index--) {
      const next = lyrics[index + 1];
      if (currentTime >= lyrics[index].time && (!next || currentTime < next.time)) return index;
    }
    return -1;
  }
  for (let index = start; index < lyrics.length; index++) {
    const line = lyrics[index];
    const next = lyrics[index + 1];
    if (!line) continue;
    if (!next) {
      if (currentTime >= line.time) return index;
    } else if (currentTime >= line.time && currentTime < next.time) return index;
  }
  return -1;
});

let pendingScrollIndex = -1;
function scrollToActive(index) {
  // 用 rAF 合并滚动，同一帧内多次切换只滚动一次，但始终记住最新 index
  pendingScrollIndex = index;
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null;
    const targetIndex = pendingScrollIndex;
    pendingScrollIndex = -1;
    const container = lyricsContainer.value;
    if (!container || targetIndex < 0) return;
    const element = lineElements.get(targetIndex);
    if (!element) return;
    const offset = element.offsetTop - container.offsetTop;
    const target = offset - container.clientHeight / 2 + element.clientHeight / 2;
    // 高频切换时用 auto，避免 smooth 动画叠加导致卡顿
    container.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
  });
}

watch(activeIndex, (index) => {
  if (index < 0 || index === lastActiveIndex) return;
  lastActiveIndex = index;
  // 用户手动滚动期间暂停自动跟随
  if (autoFollow) scrollToActive(index);
});

function onKeydown(event) {
  if (event.key === 'Escape' && props.visible) close();
}

watch(
  () => player.currentLyrics,
  () => {
    lastActiveIndex = -1;
    pendingScrollIndex = -1;
    lineElements.clear();
    autoFollow = true;
    if (userScrollTimer) {
      clearTimeout(userScrollTimer);
      userScrollTimer = null;
    }
    if (scrollRaf) {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = null;
    }
    if (lyricsContainer.value) lyricsContainer.value.scrollTop = 0;
  }
);

function onEditorSaved() {
  const track = player.currentTrack;
  if (track?.bvid) player.loadLyrics(track.bvid, track.cid || '', track.title);
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  window.electronAPI?.onLyricsEditorSaved?.(onEditorSaved);
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  pendingScrollIndex = -1;
  if (scrollRaf) {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = null;
  }
  if (userScrollTimer) clearTimeout(userScrollTimer);
  lineElements.clear();
});
</script>

<style scoped>
.lyrics-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  will-change: opacity, transform;
  /* 覆盖标题栏的拖动区域，确保内部按钮可点击 */
  -webkit-app-region: no-drag;
}

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

.lyrics-bg-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    135deg,
    rgba(10, 10, 20, 0.6) 0%,
    rgba(10, 10, 20, 0.35) 50%,
    rgba(10, 10, 20, 0.55) 100%
  );
}

.lyrics-body {
  position: relative;
  z-index: 2;
  display: flex;
  width: 100%;
  max-width: 900px;
  height: 100%;
  gap: 0;
}

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

.lyrics-left > .cover-wrap {
  margin-bottom: 28px;
}
.lyrics-left > .meta {
  margin-bottom: 24px;
}
.lyrics-left > .controls {
  margin-bottom: 24px;
}

.close {
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
  transition: all 0.2s;
  backdrop-filter: blur(8px);
}

.close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.95);
}

.cover-wrap {
  width: 200px;
  height: 200px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  background: rgba(255, 255, 255, 0.04);
}

.cover-wrap.placeholder,
.ctrl-btn,
.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-placeholder-icon {
  font-size: 64px;
  color: rgba(255, 255, 255, 0.15);
}
.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.meta {
  text-align: center;
  max-width: 260px;
}

.title,
.author {
  overflow: hidden;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  /* 标题支持换行，不截断 */
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
}
.title-muted {
  color: rgba(255, 255, 255, 0.35);
}
.author {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 4px;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 260px;
}
.author-muted {
  color: rgba(255, 255, 255, 0.25);
}
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 28px;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s;
}

.ctrl-btn:hover,
.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.ctrl-btn:hover {
  color: #fff;
}
.play-btn {
  font-size: 44px;
}
.tools {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.tool-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 20px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
}

.tool-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}
.tool-btn.active {
  color: var(--accent);
}
.tool-btn:disabled {
  opacity: 0.2;
  cursor: default;
}
.tools-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

.lyrics-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 60px 40px 40px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
  gap: 8px;
}

.empty-icon {
  font-size: 40px;
}
.empty-title {
  font-size: 16px;
  font-weight: 600;
}
.empty-hint {
  font-size: 13px;
}

.lyrics-scroll {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 20px 0;
  scroll-behavior: smooth;
}

/* 隐藏滚动条（WebKit） */
.lyrics-scroll::-webkit-scrollbar {
  display: none;
}

.lyrics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line {
  position: relative;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.3s;
  cursor: pointer;
}

.line:hover {
  background: rgba(255, 255, 255, 0.03);
}
.line.active {
  background: rgba(251, 114, 153, 0.1);
}

/* 悬浮时右侧浮现歌词时间 */
.line-time {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.5);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.line:hover .line-time {
  opacity: 1;
}

.line-text {
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.3s;
  line-height: 1.5;
  will-change: color, font-size, font-weight;
}

.line.active .line-text {
  color: #fff;
  font-size: 20px;
  font-weight: 600;
}

.line-trans {
  display: block;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 4px;
  transition: all 0.3s;
}

.line.active .line-trans.active-trans {
  color: var(--accent);
}
.lyrics-overlay-enter-active {
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.lyrics-overlay-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.lyrics-overlay-enter-active .lyrics-body {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.lyrics-overlay-leave-active .lyrics-body {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.lyrics-overlay-enter-from,
.lyrics-overlay-leave-to {
  opacity: 0;
}
.lyrics-overlay-enter-from .lyrics-body,
.lyrics-overlay-leave-to .lyrics-body {
  transform: translateY(100%);
}
</style>
