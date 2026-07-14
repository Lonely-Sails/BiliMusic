<template>
  <div class="desktop-toolbar" @mousedown="$emit('dragstart', $event)">
    <div class="tb-left">
      <button
        class="tb-btn"
        :class="{ active: locked }"
        @click="$emit('toggleLock')"
        @mouseenter="onLockEnter"
        @mouseleave="onLockLeave"
        :title="locked ? '点击解锁' : '锁定（点击穿透）'"
      >
        <Icon :icon="locked ? 'mdi:lock-open-variant' : 'mdi:lock'" />
      </button>
      <span class="tb-track-title" v-text="trackTitle" />
    </div>

    <div class="tb-center">
      <button class="tb-btn ctrl-btn" @click="prevTrack" title="上一首">
        <Icon icon="mdi:skip-previous" />
      </button>
      <button class="tb-btn play-btn" @click="togglePlay" title="播放/暂停">
        <Icon :icon="playing ? 'mdi:pause' : 'mdi:play'" />
      </button>
      <button class="tb-btn ctrl-btn" @click="nextTrack" title="下一首">
        <Icon icon="mdi:skip-next" />
      </button>
    </div>

    <div class="tb-right">
      <button class="tb-btn" @click="closeWindow" title="关闭桌面歌词">
        <Icon icon="mdi:close" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

const props = defineProps({
  locked: Boolean,
  playing: Boolean,
  trackTitle: String,
})

defineEmits(['toggleLock', 'dragstart'])

function prevTrack() {
  window.desktopLyricsAPI?.prevTrack()
}

function nextTrack() {
  window.desktopLyricsAPI?.nextTrack()
}

function togglePlay() {
  window.desktopLyricsAPI?.togglePlay()
}

function closeWindow() {
  window.desktopLyricsAPI?.hide()
}

function onLockEnter() {
  if (props.locked) {
    window.desktopLyricsAPI?.setIgnoreEvents(false)
  }
}

function onLockLeave() {
  if (props.locked) {
    window.desktopLyricsAPI?.setIgnoreEvents(true)
  }
}

</script>

<style scoped>

.desktop-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  background: rgba(0,0,0,0.5);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  z-index: 10;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}
body.hover .desktop-toolbar { visibility: visible; opacity: 1; }
body.locked .desktop-toolbar { display: flex; }

.tb-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  padding-right: 30px;
}

.tb-track-title {
  font-size: 12px;
  color: rgba(232,232,240,0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tb-center {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.tb-right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  min-width: 28px;
  justify-content: flex-end;
}

.tb-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(232,232,240,0.6);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.15s ease;
  line-height: 1;
}

.tb-btn:hover {
  background: rgba(255,255,255,0.12);
  color: #ffffff;
}

.tb-btn.active {
  color: #fb7299;
}

.tb-btn.active:hover {
  background: rgba(251,114,153,0.2);
}

.tb-btn svg {
  display: block;
  width: 18px;
  height: 18px;
}

body.locked .desktop-toolbar .tb-track-title,
body.locked .desktop-toolbar .tb-center,
body.locked .desktop-toolbar .tb-right {
  display: none;
}

body.locked .desktop-toolbar {
  background: transparent;
  border-bottom: none;
}

body.locked .desktop-toolbar .tb-left {
  justify-content: center;
  padding-right: 0;
}
</style>
