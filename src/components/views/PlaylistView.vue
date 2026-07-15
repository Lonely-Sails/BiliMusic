<template>
  <TooltipProvider>
    <div class="playlist-view">
      <div class="playlist-header">
        <h2>
          <Icon icon="mdi:playlist-music" class="section-icon" />播放列表
        </h2>
        <div class="playlist-actions" v-if="player.playlist.length">
          <span class="playlist-count">{{ player.playlist.length }} 首</span>
          <Separator orientation="vertical" class="playlist-separator" />
          <TooltipRoot>
            <TooltipTrigger as-child>
              <button class="clear-btn" @click="player.clearPlaylist()">
                <Icon icon="mdi:delete-sweep-outline" />清空列表
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                清空播放列表
                <TooltipArrow class="tooltip-arrow" />
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </div>
      </div>

      <div v-if="!player.playlist.length" class="empty-playlist">
        <Icon icon="mdi:playlist-music-outline" class="empty-icon" />
        <p class="empty-title">播放列表为空</p>
        <p class="empty-hint">从搜索或收藏夹添加歌曲</p>
      </div>

      <div v-else class="playlist-items">
        <div v-for="(item, index) in player.playlist" :key="item.bvid + '-' + index" class="playlist-item"
          :class="{ active: index === player.currentIndex }" @click="player.playAtIndex(index)">
          <div class="item-cover">
            <img :src="item.cover + '@200w_200h.webp'" :alt="item.title" loading="lazy" />
            <div class="item-playing" v-if="index === player.currentIndex">
              <span class="bar" v-for="n in 4" :key="n" />
            </div>
          </div>
          <div class="item-info">
            <div class="item-title" :title="item.title">
              <span v-if="index === player.currentIndex" class="now-label">NOW</span>{{ item.title }}
            </div>
            <div class="item-author">{{ item.author || '未知' }}</div>
          </div>
          <div class="item-duration">{{ formatDuration(item.duration) }}</div>
          <div class="item-actions">
            <TooltipRoot v-if="user.loggedIn && user.favFolderId">
              <TooltipTrigger as-child>
                <button class="item-fav-btn" :class="{ favorited: user.isFavorited(item.bvid) }"
                  @click.stop="user.toggleFav(item)">
                  <Icon :icon="user.isFavorited(item.bvid) ? 'mdi:heart' : 'mdi:heart-outline'" />
                </button>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                  {{ user.isFavorited(item.bvid) ? '取消收藏' : '收藏到「' + user.favFolderName + '」' }}
                  <TooltipArrow class="tooltip-arrow" />
                </TooltipContent>
              </TooltipPortal>
            </TooltipRoot>
            <TooltipRoot>
              <TooltipTrigger as-child>
                <button class="item-remove" @click.stop="player.removeFromPlaylist(index)">
                  <Icon icon="mdi:close" />
                </button>
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent class="tooltip-content" :data-state="'instant-open'" side="top">
                  从播放列表移除
                  <TooltipArrow class="tooltip-arrow" />
                </TooltipContent>
              </TooltipPortal>
            </TooltipRoot>
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>

<script setup>
/**
 * PlaylistView.vue — 播放列表页
 *
 * 显示 player store 中的 playlist，支持点击播放、
 * 收藏切换、从列表移除。
 */

import { usePlayerStore } from '../../stores/player'
import { useUserStore } from '../../stores/user'
import { Icon } from '@iconify/vue'
import { TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow, TooltipProvider, Separator } from 'reka-ui'

const player = usePlayerStore()
const user = useUserStore()

/** 格式化秒数为 m:ss 或 --:-- */
function formatDuration(seconds) {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
.playlist-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px 32px;
}

.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.playlist-header h2 {
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
}

.playlist-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.playlist-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.playlist-separator {
  width: 1px;
  height: 16px;
  background: var(--border);
}

.clear-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: inherit;
}

.clear-btn:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.playlist-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition);
}

.playlist-item:hover {
  background: var(--bg-card);
}

.playlist-item.active {
  background: var(--accent-dim);
}

.item-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  background: var(--bg-tertiary);
}

.item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-playing {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.bar {
  width: 3px;
  background: var(--accent);
  border-radius: 1px;
  animation: playing 0.6s ease-in-out infinite alternate;
}

.bar:nth-child(1) {
  height: 10px;
}

.bar:nth-child(2) {
  height: 14px;
  animation-delay: 0.1s;
}

.bar:nth-child(3) {
  height: 18px;
  animation-delay: 0.2s;
}

.bar:nth-child(4) {
  height: 12px;
  animation-delay: 0.3s;
}

@keyframes playing {
  0% {
    height: 4px;
  }

  100% {
    height: 20px;
  }
}

.item-info {
  flex: 1;
  overflow: hidden;
}

.item-title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

.now-label {
  font-size: 9px;
  color: var(--accent);
  font-weight: 800;
  letter-spacing: 0.5px;
}

.item-author {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.item-duration {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.item-fav-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 15px;
  cursor: pointer;
  padding: 4px;
  transition: all var(--transition);
  display: flex;
  align-items: center;
  border-radius: 4px;
}

.item-fav-btn:hover {
  color: var(--accent);
  background: var(--accent-dim);
}

.item-fav-btn.favorited {
  color: var(--accent);
}

.item-remove {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  transition: all var(--transition);
  display: flex;
  align-items: center;
  border-radius: 4px;
}

.item-remove:hover {
  color: var(--danger);
  background: rgba(255, 71, 87, 0.1);
}

.empty-playlist {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  color: var(--text-muted);
  gap: 8px;
}
</style>
