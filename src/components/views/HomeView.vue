<template>
  <div class="home-view">
    <div v-if="loading && !toplist.length" class="loading-state">
      <div class="spinner" /><span>正在加载音乐数据...</span>
    </div>
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle-outline" class="error-icon" />
      <p>{{ error }}</p>
      <button @click="loadAll" class="retry-btn">重试</button>
    </div>
    <template v-else>
      <section class="hero-section" v-if="hero">
        <div class="hero-bg" :style="{ backgroundImage: `url(${hero.mv_cover})` }" />
        <div class="hero-overlay" />
        <div class="hero-content">
          <div class="hero-badge">
            <Icon icon="mdi:trophy" />本周热歌榜
          </div>
          <div class="hero-rank">#{{ hero.rank }}</div>
          <h1 class="hero-title">{{ hero.music_title }}</h1>
          <p class="hero-artist">{{ hero.singer }}</p>
          <div class="hero-meta">
            <span class="hero-tag" v-if="hero.is_new">
              <Icon icon="mdi:flash" />新上榜
            </span>
            <span class="hero-heat">
              <Icon icon="mdi:fire" /> {{ formatHeat(hero.heat) }}
            </span>
            <span class="hero-recommend" v-if="hero.recommendation">
              <Icon icon="mdi:music-note" /> {{ hero.recommendation }}
            </span>
          </div>
          <div class="hero-actions">
            <button class="hero-play-btn" @click="playHero">
              <Icon icon="mdi:play" />立即播放
            </button>
            <button class="hero-add-btn" @click="addHeroToPlaylist">
              <Icon icon="mdi:playlist-plus" />
            </button>
          </div>
        </div>
      </section>

      <section class="section" v-if="toplist.length > 0">
        <div class="section-header">
          <h2 class="section-title">
            <Icon icon="mdi:chart-bar" class="section-icon" />热歌 TOP 10
          </h2>
          <span class="section-subtitle">B站本周最热音乐排行</span>
        </div>
        <div class="toplist">
          <div v-for="(item, index) in toplist.slice(0, 10)" :key="item.music_id" class="toplist-item"
            :class="{ 'top-three': index < 3 }" @click="playToplist(item)">
            <div class="toplist-rank">
              <span class="rank-num" v-if="index < 3">{{ index + 1 }}</span>
              <span class="rank-num-lg" v-else>{{ index + 1 }}</span>
              <div class="rank-change" v-if="item.rank_changes !== undefined">
                <Icon v-if="item.rank_changes > 0" icon="mdi:arrow-up-bold" class="change-up" />
                <Icon v-else-if="item.rank_changes < 0" icon="mdi:arrow-down-bold" class="change-down" />
                <Icon v-else icon="mdi:minus" class="change-equal" />
                <span v-if="item.rank_changes !== 0" class="change-num">{{ Math.abs(item.rank_changes) }}</span>
              </div>
              <div v-else-if="item.is_new" class="rank-new">NEW</div>
            </div>
            <div class="toplist-cover" v-if="item.mv_cover">
              <img :src="item.mv_cover + '@160w_160h.webp'" :alt="item.music_title" loading="lazy" />
            </div>
            <div class="toplist-info">
              <h4 class="toplist-title">{{ item.music_title }}</h4>
              <p class="toplist-artist">{{ item.singer }}</p>
            </div>
            <div class="toplist-heat">
              <ProgressRoot :model-value="item.heat / maxHeat * 100" class="heat-bar" :max="100">
                <ProgressIndicator class="heat-fill" />
              </ProgressRoot>
              <span class="heat-text">{{ formatHeat(item.heat) }}</span>
            </div>
            <button class="toplist-play-btn" @click.stop="playToplist(item)">
              <Icon icon="mdi:play-circle-outline" />
            </button>
            <button v-if="user.loggedIn && user.favFolderId" class="toplist-fav-btn"
              :class="{ favorited: user.isFavorited(item.mv_bvid) }" @click.stop="toggleToplistFav(item)">
              <Icon :icon="user.isFavorited(item.mv_bvid) ? 'mdi:heart' : 'mdi:heart-outline'" />
            </button>
          </div>
        </div>
      </section>

      <section class="section" v-if="hotRank.length > 0">
        <div class="section-header">
          <h2 class="section-title">
            <Icon icon="mdi:fire" class="section-icon" />热门推荐
          </h2>
          <span class="section-subtitle">累计播放量最高的音乐</span>
        </div>
        <div class="hot-grid">
          <SongCard v-for="item in hotRank" :key="item.music_id" :item="mapHotRankItem(item)" />
        </div>
      </section>

      <section class="section" v-if="newMusic.length > 0">
        <div class="section-header">
          <h2 class="section-title">
            <Icon icon="mdi:music-box-multiple" class="section-icon" />新歌首发
          </h2>
          <span class="section-subtitle">最新上架的优质音乐</span>
        </div>
        <ScrollAreaRoot class="nm-scrollarea-root">
          <ScrollAreaViewport class="nm-scrollarea-viewport">
            <div class="new-music-track">
              <div v-for="item in newMusic" :key="item.music_id" class="new-music-card" @click="playNewMusic(item)">
                <div class="nm-card-cover">
                  <img :src="item.cover + '@400w_400h.webp'" :alt="item.music_title" loading="lazy" />
                  <div class="nm-card-overlay">
                    <Icon icon="mdi:play-circle" class="nm-play-icon" />
                  </div>
                  <span class="nm-card-corner" v-if="item.music_corner">{{ item.music_corner }}</span>
                </div>
                <div class="nm-card-info">
                  <h4 class="nm-card-title">{{ item.music_title }}</h4>
                  <p class="nm-card-artist">{{ item.author }}</p>
                </div>
              </div>
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar class="nm-scrollarea-scrollbar" orientation="horizontal">
            <ScrollAreaThumb class="nm-scrollarea-thumb" />
          </ScrollAreaScrollbar>
          <ScrollAreaCorner class="nm-scrollarea-corner" />
        </ScrollAreaRoot>
      </section>
    </template>
  </div>
</template>

<script setup>
/**
 * HomeView.vue — 首页推荐
 *
 * 区域：
 * 1. Hero — 热歌榜第一名（大封面背景 + 播放按钮）
 * 2. TOP 10 — 热歌榜（带排名变化/热度条）
 * 3. 热门推荐 — 按播放量排序的卡片网格
 * 4. 新歌首发 — 横向滚动卡片
 *
 * 数据来源：musicCenter API（getHotToplist / getHotRank / getNewMusic）
 */

import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import SongCard from '../SongCard.vue'
import { usePlayerStore } from '../../stores/player'
import { useUserStore } from '../../stores/user'
import { ProgressRoot, ProgressIndicator, ScrollAreaRoot, ScrollAreaViewport, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner } from 'reka-ui'

const player = usePlayerStore()
const user = useUserStore()
const loading = ref(true)
const error = ref('')
const durationCache = new Map()  // bvid → duration 缓存

const banner = ref(null)
const toplist = ref([])    // 热歌 TOP10 列表
const hotRank = ref([])    // 热门推荐列表
const newMusic = ref([])   // 新歌列表

/** Hero 区域数据 — 取 TOP10 第一名 */
const hero = computed(() => {
  if (!toplist.value.length) return null
  const top = toplist.value[0]
  return { ...top, mv_cover: top.mv_cover || '' }
})

/** TOP10 中最大热度值（用于归一化热度条） */
const maxHeat = computed(() => {
  if (!toplist.value.length) return 1
  return Math.max(...toplist.value.map(t => t.heat || 0))
})

onMounted(() => loadAll())

/** 加载所有首页数据 */
async function loadAll() {
  loading.value = true; error.value = ''
  await safeCall(() => window.electronAPI.ensureSession())
  try {
    const [toplistData, hotRankData, newMusicData] = await Promise.all([
      safeCall(() => window.electronAPI.getHotToplist()),
      safeCall(() => window.electronAPI.getHotRank()),
      safeCall(() => window.electronAPI.getNewMusic()),
    ])
    if (toplistData?.list) toplist.value = toplistData.list
    if (hotRankData?.list) hotRank.value = hotRankData.list.slice(0, 20)
    if (newMusicData?.list) newMusic.value = newMusicData.list.slice(0, 12)

    // 惰性补齐缺失的歌曲时长
    const allItems = [...(hotRank.value || []), ...(newMusic.value || [])]
    for (const item of allItems) {
      if (!item.duration) fetchMissingDuration(item).catch(() => { })
    }
    if (!toplistData && !hotRankData && !newMusicData) error.value = '暂时无法获取音乐数据'
  } catch (e) { error.value = '加载失败: ' + e.message }
  finally { loading.value = false }
}

/** 安全调用 API（忽略业务错误，仅返回 null） */
async function safeCall(fn) {
  try {
    const result = await fn()
    if (result?.error) { console.warn('[BiliMusic] API:', result.error); return null }
    return result
  } catch (e) { console.warn('[BiliMusic] API error:', e); return null }
}

/** 通过 API 补齐歌曲时长（惰性加载 + Map 缓存） */
async function fetchMissingDuration(item) {
  if (!item.bvid || item.duration > 0) return
  if (durationCache.has(item.bvid)) { item.duration = durationCache.get(item.bvid); return }
  try {
    const info = await window.electronAPI.getVideoInfo(item.bvid, item.aid || 0)
    if (info?.duration) { item.duration = info.duration; durationCache.set(item.bvid, info.duration) }
  } catch { }
}

function mapHotRankItem(item) {
  return { bvid: item.bvid || '', aid: item.aid || 0, title: item.music_title, cover: item.cover || '', duration: item.duration || 0, author: item.author || '', play: item.total_vv || 0, cid: item.cid || null }
}

function mapToplistItem(item) {
  return { bvid: item.mv_bvid || '', aid: item.mv_aid || 0, title: item.music_title, cover: item.mv_cover || '', duration: item.duration || 0, author: item.singer || '', play: item.heat || 0, cid: null }
}

function mapNewMusicItem(item) {
  return { bvid: item.bvid || '', aid: item.aid || 0, title: item.music_title, cover: item.cover || '', duration: item.duration || 0, author: item.author || '', play: item.wish_count || 0, cid: item.cid || null }
}

function playToplist(item) { const track = mapToplistItem(item); if (track.bvid || track.aid) player.playTrack(track) }
async function toggleToplistFav(item) { const fi = { bvid: item.mv_bvid || '', aid: item.mv_aid || 0 }; if (fi.bvid || fi.aid) await user.toggleFav(fi) }
function playHero() { playToplist(toplist.value[0]) }
function addHeroToPlaylist() { const item = toplist.value[0]; if (item) player.addToPlaylist(mapToplistItem(item)) }
function playNewMusic(item) { const track = mapNewMusicItem(item); if (track.bvid || track.aid) player.playTrack(track) }

function formatHeat(heat) {
  if (!heat) return '0'
  if (heat >= 100000000) return (heat / 100000000).toFixed(1) + '亿'
  if (heat >= 10000) return (heat / 10000).toFixed(1) + '万'
  return String(heat)
}
</script>

<style scoped>
.home-view {
  padding: 28px 32px 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.section {
  margin-bottom: 44px;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  font-size: 20px;
  color: var(--accent);
}

.section-subtitle {
  font-size: 12px;
  color: var(--text-muted);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 20px;
  gap: 16px;
  color: var(--text-muted);
}

.loading-state .spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  font-size: 40px;
  color: var(--danger);
}

.error-state p {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}

.retry-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.retry-btn:hover {
  border-color: var(--accent-dim);
  color: var(--accent);
}

.hero-section {
  position: relative;
  height: 340px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  margin-bottom: 40px;
  display: flex;
  align-items: flex-end;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(6px) brightness(0.4);
  transform: scale(1.1);
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(10, 10, 20, 0.8) 0%, rgba(10, 10, 20, 0.2) 60%, transparent 100%);
}

.hero-content {
  position: relative;
  z-index: 1;
  padding: 32px;
  width: 100%;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-xl);
  margin-bottom: 12px;
}

.hero-rank {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.hero-title {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 4px;
}

.hero-artist {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.hero-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.hero-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.hero-actions {
  display: flex;
  gap: 8px;
}

.hero-play-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 10px 24px;
  border-radius: var(--radius-xl);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.hero-play-btn:hover {
  background: var(--accent-hover);
}

.hero-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: all var(--transition);
}

.hero-add-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.toplist {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toplist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition);
}

.toplist-item:hover {
  background: var(--bg-card);
}

.toplist-rank {
  width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.rank-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent);
}

.rank-num-lg {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-muted);
}

.rank-change {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  margin-top: 2px;
}

.change-up {
  color: #4ade80;
  font-size: 14px;
}

.change-down {
  color: var(--danger);
  font-size: 14px;
}

.change-equal {
  color: var(--text-muted);
  font-size: 10px;
}

.change-num {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}

.rank-new {
  font-size: 9px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.toplist-cover {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-tertiary);
}

.toplist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.toplist-info {
  flex: 1;
  overflow: hidden;
}

.toplist-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toplist-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.toplist-heat {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 100px;
}

.heat-bar {
  width: 60px;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.heat-fill {
  height: 100%;
  background: var(--text-muted);
  border-radius: 2px;
  transition: width 0.3s;
}

.heat-text {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 36px;
  text-align: right;
}

.toplist-play-btn,
.toplist-fav-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  transition: all var(--transition);
  border-radius: 50%;
  display: flex;
}

.toplist-play-btn:hover {
  color: var(--accent);
  background: var(--accent-dim);
}

.toplist-fav-btn:hover {
  color: var(--accent);
  background: var(--accent-dim);
}

.toplist-fav-btn.favorited {
  color: var(--accent);
}

.hot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.nm-scrollarea-root {
  width: 100%;
}

.nm-scrollarea-viewport {
  overflow-x: auto;
}

.new-music-track {
  display: flex;
  gap: 16px;
  padding-bottom: 4px;
}

.new-music-card {
  flex-shrink: 0;
  width: 180px;
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: all var(--transition);
  background: var(--bg-card);
  border: 1px solid var(--border);
}

.new-music-card:hover {
  border-color: var(--accent-dim);
}

.nm-card-cover {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.nm-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nm-card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition);
}

.new-music-card:hover .nm-card-overlay {
  opacity: 1;
}

.nm-play-icon {
  font-size: 40px;
  color: #fff;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
}

.nm-card-corner {
  position: absolute;
  top: 8px;
  left: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.nm-card-info {
  padding: 10px;
}

.nm-card-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nm-card-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nm-scrollarea-scrollbar {
  display: flex;
  height: 6px;
  padding: 1px 0;
}

.nm-scrollarea-thumb {
  flex: 1;
  background: var(--border);
  border-radius: 3px;
  min-height: 4px;
}

.nm-scrollarea-corner {
  background: transparent;
}
</style>
