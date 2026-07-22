<template>
  <TooltipProvider>
    <div class="song-card" @click="play">
      <div class="card-cover">
        <img :src="item.cover + '@1280w_800h.webp'" :alt="item.title" loading="lazy" />
        <div class="card-overlay">
          <Icon icon="mdi:play-circle-outline" class="play-icon" />
        </div>
        <span class="card-duration">{{ formatDuration(item.duration) }}</span>
        <Tooltip v-if="item.season" :text="'查看合集「' + item.season.title + '」'" side="top">
          <button class="season-badge" @click.stop="openSeason">
            <Icon icon="mdi:layers-outline" />
            <span>{{ item.season.epCount || '合集' }}</span>
          </button>
        </Tooltip>
        <div class="card-actions">
          <Tooltip text="添加到播放列表" side="top">
            <button class="action-btn add-btn" @click.stop="addToPlaylist">
              <Icon icon="mdi:plus" />
            </button>
          </Tooltip>
          <Tooltip v-if="user.loggedIn && user.favFolderId" :text="user.isFavorited(item.bvid) ? '取消收藏' : '收藏到「' + user.favFolderName + '」'" side="top">
            <button class="action-btn fav-btn" :class="{ favorited: user.isFavorited(item.bvid) }"
              @click.stop="toggleFav">
              <Icon :icon="user.isFavorited(item.bvid) ? 'mdi:heart' : 'mdi:heart-outline'" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div class="card-info">
        <h4 class="card-title" :title="item.title">{{ item.title }}</h4>
        <p class="card-author">
          <Icon icon="mdi:account-outline" class="meta-icon" /> {{ item.author }}
        </p>
        <p class="card-stats" v-if="showPlayCount">
          <Icon icon="mdi:play-circle-outline" class="meta-icon" /> {{ formatNumber(item.play) }}
        </p>
      </div>
    </div>
  </TooltipProvider>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import { Icon } from '@iconify/vue'
import TooltipProvider from './ui/TooltipProvider.vue'
import Tooltip from './ui/Tooltip.vue'

const props = defineProps({
  item: { type: Object, required: true },
  showPlayCount: { type: Boolean, default: true }
})

const emit = defineEmits(['fav-change'])

const router = useRouter()
const player = usePlayerStore()
const user = useUserStore()

function play() { player.playTrack(props.item) }
function addToPlaylist() { player.addToPlaylist(props.item) }
function openSeason() {
  const s = props.item.season
  if (s) router.push({ name: 'collection', query: { mid: s.mid, seasonId: s.seasonId, name: s.title } })
}
async function toggleFav() {
  const result = await user.toggleFav(props.item)
  if (result) emit('fav-change', result)
}
function formatDuration(duration) {
  if (!duration) return '--:--'
  if (typeof duration === 'string' && duration.includes(':')) return duration
  const m = Math.floor(duration / 60)
  const s = duration % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
function formatNumber(num) {
  if (!num) return '0'
  return num >= 10000 ? (num / 10000).toFixed(1) + '万' : String(num)
}
</script>

<style scoped>
.song-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
  border: 1px solid var(--border);
}

.song-card:hover {
  box-shadow: 0 12px 32px var(--shadow);
  border-color: var(--accent-dim);
}

.card-cover {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.song-card:hover .card-cover img {
  transform: scale(1.08);
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.1) 50%, transparent 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition);
}

.song-card:hover .card-overlay {
  opacity: 1;
}

.play-icon {
  font-size: 40px;
  color: #fff;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
}

.card-duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
  z-index: 2;
}

.season-badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: background var(--transition);
}

.season-badge:hover {
  background: var(--accent);
}

.card-info {
  padding: 12px;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-author,
.card-stats {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition);
  z-index: 2;
}

.song-card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  backdrop-filter: blur(4px);
}

.action-btn:hover {
  background: var(--accent);
  color: var(--bg-deep);
}

.fav-btn.favorited {
  background: var(--accent);
  color: #fff;
}

.fav-btn.favorited:hover {
  background: rgba(0, 0, 0, 0.65);
  color: var(--accent);
}
</style>
