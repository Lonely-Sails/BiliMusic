<template>
  <div class="home-view">
    <!-- 全局加载状态 -->
    <div v-if="loading && !toplist.length" class="loading-state">
      <div class="spinner"></div>
      <span>正在加载音乐数据...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <Icon icon="mdi:alert-circle-outline" class="error-icon" />
      <p>{{ error }}</p>
      <button @click="loadAll" class="retry-btn">重试</button>
    </div>

    <template v-else>
      <!-- ===== Hero 区域 ===== -->
      <section class="hero-section" v-if="hero">
        <div class="hero-bg" :style="{ backgroundImage: `url(${hero.mv_cover})` }"></div>
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <div class="hero-badge">
            <Icon icon="mdi:trophy" />
            本周热歌榜
          </div>
          <div class="hero-rank">#{{ hero.rank }}</div>
          <h1 class="hero-title">{{ hero.music_title }}</h1>
          <p class="hero-artist">{{ hero.singer }}</p>
          <div class="hero-meta">
            <span class="hero-tag" v-if="hero.is_new">
              <Icon icon="mdi:flash" /> 新上榜
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
              <Icon icon="mdi:play" />
              立即播放
            </button>
            <button class="hero-add-btn" @click="addHeroToPlaylist">
              <Icon icon="mdi:playlist-plus" />
            </button>
          </div>
        </div>
      </section>

      <!-- ===== TOP 10 榜单 ===== -->
      <section class="section" v-if="toplist.length > 0">
        <div class="section-header">
          <h2 class="section-title">
            <Icon icon="mdi:chart-bar" class="section-icon" />
            热歌 TOP 10
          </h2>
          <span class="section-subtitle">B站本周最热音乐排行</span>
        </div>
        <div class="toplist">
          <div
            v-for="(item, index) in toplist.slice(0, 10)"
            :key="item.music_id"
            class="toplist-item"
            :class="{ 'top-three': index < 3, 'active': index === 0 }"
            @click="playToplist(item)"
          >
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
              <img :src="item.mv_cover + '@80w_80h.webp'" :alt="item.music_title" loading="lazy" />
            </div>
            <div class="toplist-info">
              <h4 class="toplist-title">{{ item.music_title }}</h4>
              <p class="toplist-artist">{{ item.singer }}</p>
            </div>
            <div class="toplist-heat">
              <ProgressRoot
                :model-value="item.heat / maxHeat * 100"
                class="heat-bar"
                :max="100"
              >
                <ProgressIndicator
                  class="heat-fill"
                />
              </ProgressRoot>
              <span class="heat-text">{{ formatHeat(item.heat) }}</span>
            </div>
            <button class="toplist-play-btn" @click.stop="playToplist(item)">
              <Icon icon="mdi:play-circle-outline" />
            </button>
            <button
              v-if="user.loggedIn && user.favFolderId"
              class="toplist-fav-btn"
              :class="{ favorited: user.isFavorited(item.mv_bvid) }"
              @click.stop="toggleToplistFav(item)"
            >
              <Icon :icon="user.isFavorited(item.mv_bvid) ? 'mdi:heart' : 'mdi:heart-outline'" />
            </button>
          </div>
        </div>
      </section>

      <!-- ===== 热门推荐 ===== -->
      <section class="section" v-if="hotRank.length > 0">
        <div class="section-header">
          <h2 class="section-title">
            <Icon icon="mdi:fire" class="section-icon" />
            热门推荐
          </h2>
          <span class="section-subtitle">累计播放量最高的音乐</span>
        </div>
        <div class="hot-grid">
          <SongCard
            v-for="item in hotRank"
            :key="item.music_id"
            :item="mapHotRankItem(item)"
          />
        </div>
      </section>

      <!-- ===== 新歌首发 ===== -->
      <section class="section" v-if="newMusic.length > 0">
        <div class="section-header">
          <h2 class="section-title">
            <Icon icon="mdi:music-box-multiple" class="section-icon" />
            新歌首发
          </h2>
          <span class="section-subtitle">最新上架的优质音乐</span>
        </div>
        <ScrollAreaRoot class="nm-scrollarea-root">
          <ScrollAreaViewport class="nm-scrollarea-viewport">
            <div class="new-music-track">
              <div
                v-for="item in newMusic"
                :key="item.music_id"
                class="new-music-card"
                @click="playNewMusic(item)"
              >
                <div class="nm-card-cover">
                  <img :src="item.cover + '@200w_200h.webp'" :alt="item.music_title" loading="lazy" />
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

<script>
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import SongCard from './SongCard.vue'
import { usePlayerStore } from '../stores/player'
import { useUserStore } from '../stores/user'
import {
  ProgressRoot, ProgressIndicator,
  ScrollAreaRoot, ScrollAreaViewport, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner
} from 'reka-ui'

export default {
  name: 'HomeView',
  components: {
    Icon, SongCard,
    ProgressRoot, ProgressIndicator,
    ScrollAreaRoot, ScrollAreaViewport, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner
  },
  setup() {
    const player = usePlayerStore()
    const user = useUserStore()
    const loading = ref(true)
    const error = ref('')

    // Data sources
    const banner = ref(null)
    const toplist = ref([])
    const hotRank = ref([])
    const newMusic = ref([])

    const hero = computed(() => {
      if (toplist.value.length > 0) {
        const top = toplist.value[0]
        // Try to use mv_cover, fallback to first item or placeholder
        return {
          ...top,
          mv_cover: top.mv_cover || 'https://i0.hdslb.com/bfs/station_src/music_metadata/default.jpg'
        }
      }
      return null
    })

    const maxHeat = computed(() => {
      if (toplist.value.length === 0) return 1
      return Math.max(...toplist.value.map((t) => t.heat || 0))
    })

    onMounted(() => {
      loadAll()
    })

    async function loadAll() {
      loading.value = true
      error.value = ''

      // 先确保 session/buvid cookie 已就绪，避免风控拦截
      await safeCall(() => window.electronAPI.ensureSession()).catch(() => {})

      try {
        const [toplistData, hotRankData, newMusicData, bannerData] = await Promise.all([
          safeCall(() => window.electronAPI.getHotToplist()),
          safeCall(() => window.electronAPI.getHotRank()),
          safeCall(() => window.electronAPI.getNewMusic()),
          safeCall(() => window.electronAPI.getMusicBanner())
        ])

        if (toplistData?.list) toplist.value = toplistData.list
        if (hotRankData?.list) hotRank.value = hotRankData.list.slice(0, 20)
        if (newMusicData?.list) newMusic.value = newMusicData.list.slice(0, 12)
        if (bannerData) banner.value = bannerData

        // 如果所有数据都为空，显示提示
        if (!toplistData && !hotRankData && !newMusicData) {
          error.value = '暂时无法获取音乐数据，请稍后重试'
        }
      } catch (e) {
        error.value = '加载失败: ' + e.message
      } finally {
        loading.value = false
      }
    }

    async function safeCall(fn) {
      try {
        const result = await fn()
        if (result && result.error) {
          console.warn('API warning:', result.error)
          return null
        }
        return result
      } catch (e) {
        console.warn('API error:', e)
        return null
      }
    }

    function mapHotRankItem(item) {
      return {
        bvid: item.bvid || '',
        aid: item.aid || 0,
        title: item.music_title,
        cover: item.cover || '',
        duration: 0,
        author: item.author || '',
        play: item.total_vv || 0,
        cid: item.cid || null
      }
    }

    function mapToplistItem(item) {
      return {
        bvid: item.mv_bvid || '',
        aid: item.mv_aid || 0,
        title: item.music_title,
        cover: item.mv_cover || '',
        duration: 0,
        author: item.singer || '',
        play: item.heat || 0,
        cid: null
      }
    }

    function mapNewMusicItem(item) {
      return {
        bvid: item.bvid || '',
        aid: item.aid || 0,
        title: item.music_title,
        cover: item.cover || '',
        duration: 0,
        author: item.author || '',
        play: item.wish_count || 0,
        cid: item.cid || null
      }
    }

    function playToplist(item) {
      const track = mapToplistItem(item)
      if (!track.bvid && track.aid) {
        // Try to find bvid from hot rank data
        const hotItem = hotRank.value.find((h) => h.music_id === item.music_id)
        if (hotItem?.bvid) track.bvid = hotItem.bvid
      }
      if (track.bvid || track.aid) {
        player.playTrack(track)
      }
    }

    async function toggleToplistFav(item) {
      const favItem = {
        bvid: item.mv_bvid || '',
        aid: item.mv_aid || 0
      }
      if (favItem.bvid || favItem.aid) {
        await user.toggleFav(favItem)
      }
    }

    function playHero() {
      playToplist(toplist.value[0])
    }

    function addHeroToPlaylist() {
      const item = toplist.value[0]
      if (item) {
        player.addToPlaylist(mapToplistItem(item))
      }
    }

    function playNewMusic(item) {
      const track = mapNewMusicItem(item)
      if (track.aid) {
        player.playTrack(track)
      }
    }

    function formatHeat(heat) {
      if (!heat) return '0'
      if (heat >= 100000000) return (heat / 100000000).toFixed(1) + '亿'
      if (heat >= 10000) return (heat / 10000).toFixed(1) + '万'
      return String(heat)
    }

    return {
      loading, error,
      banner, toplist, hotRank, newMusic,
      hero, maxHeat,
      loadAll, mapHotRankItem, playToplist, playHero,
      addHeroToPlaylist, playNewMusic, formatHeat,
      player, user, toggleToplistFav
    }
  }
}
</script>

<style scoped>
/* ===== Layout ===== */
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

/* ===== Loading / Error ===== */
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
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-state .error-icon { font-size: 40px; color: var(--danger); }
.error-state p { font-size: 14px; color: var(--text-secondary); text-align: center; }

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
.retry-btn:hover { border-color: var(--accent-dim); color: var(--accent); }

/* ===== Hero Section ===== */
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
  transition: filter 0.5s ease;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(251, 114, 153, 0.15) 0%,
    rgba(0, 161, 214, 0.08) 50%,
    rgba(15, 15, 26, 0.75) 100%
  );
}

.hero-content {
  position: relative;
  z-index: 1;
  padding: 36px;
  max-width: 600px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.12);
  border: 1px solid rgba(255, 215, 0, 0.25);
  padding: 4px 12px;
  border-radius: var(--radius-xl);
  margin-bottom: 14px;
  letter-spacing: 0.5px;
}

.hero-rank {
  font-size: 72px;
  font-weight: 900;
  line-height: 1;
  color: rgba(255, 255, 255, 0.08);
  position: absolute;
  right: 36px;
  top: 20px;
  font-family: 'Georgia', serif;
  letter-spacing: -4px;
}

.hero-title {
  font-size: 28px;
  font-weight: 800;
  color: white;
  margin-bottom: 6px;
  line-height: 1.2;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

.hero-artist {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 14px;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.hero-tag,
.hero-heat,
.hero-recommend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.hero-tag { color: var(--accent); }

.hero-actions {
  display: flex;
  gap: 10px;
}

.hero-play-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--accent);
  color: white;
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
  transform: scale(1.03);
  box-shadow: 0 4px 20px var(--accent-glow);
}

.hero-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: all var(--transition);
}
.hero-add-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

/* ===== TOP 10 List ===== */
.toplist {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.toplist-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
}

.toplist-item:hover {
  background: var(--bg-hover);
}

.toplist-item.active {
  background: linear-gradient(90deg, var(--accent-dim) 0%, transparent 100%);
}

.toplist-item + .toplist-item {
  border-top: 1px solid var(--border);
}

/* Rank */
.toplist-rank {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 52px;
}

.top-three .rank-num {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 800;
  color: white;
}

.toplist-item:nth-child(1) .rank-num { background: #ff4757; }
.toplist-item:nth-child(2) .rank-num { background: #ff6b81; }
.toplist-item:nth-child(3) .rank-num { background: #ffa502; }

.rank-num-lg {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-muted);
  min-width: 24px;
  text-align: center;
}

.rank-change {
  display: flex;
  align-items: center;
  gap: 1px;
  font-size: 9px;
}

.change-up { color: #2ed573; font-size: 10px; }
.change-down { color: var(--accent); font-size: 10px; }
.change-equal { color: var(--text-muted); font-size: 8px; }
.change-num { font-size: 9px; font-weight: 600; }
.change-up + .change-num { color: #2ed573; }
.change-down + .change-num { color: var(--accent); }

.rank-new {
  font-size: 9px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-dim);
  padding: 1px 5px;
  border-radius: 3px;
}

/* Cover */
.toplist-cover {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-tertiary);
}
.toplist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Info */
.toplist-info {
  flex: 1;
  min-width: 0;
}

.toplist-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toplist-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Heat bar */
.toplist-heat {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 120px;
}

.heat-bar {
  flex: 1;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
  max-width: 100px;
  position: relative;
}

.heat-fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #ffa502);
  border-radius: 2px;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.heat-text {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 45px;
  text-align: right;
}

/* Play button */
.toplist-play-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 22px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  opacity: 0;
  transition: all var(--transition);
  border-radius: 50%;
}

.toplist-item:hover .toplist-play-btn {
  opacity: 1;
}

.toplist-play-btn:hover {
  color: var(--accent);
  background: var(--accent-dim);
}

.toplist-fav-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  opacity: 0;
  transition: all var(--transition);
  border-radius: 50%;
  margin-left: 2px;
}

.toplist-item:hover .toplist-fav-btn {
  opacity: 1;
}

.toplist-fav-btn:hover {
  color: var(--accent);
  background: var(--accent-dim);
}

.toplist-fav-btn.favorited {
  color: var(--accent);
}


/* ===== Hot Grid ===== */
.hot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

/* ===== New Music ===== */
.nm-scrollarea-root {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 210px;
}

.nm-scrollarea-viewport {
  width: 100%;
  height: 100%;
}

.nm-scrollarea-scrollbar {
  display: flex;
  height: 6px;
  padding: 1px 0;
  z-index: 10;
}

.nm-scrollarea-thumb {
  flex: 1;
  background: var(--border);
  border-radius: 3px;
  min-height: 6px;
}
.nm-scrollarea-thumb:hover {
  background: var(--text-muted);
}

.nm-scrollarea-corner {
  background: transparent;
}

.new-music-track {
  display: flex;
  gap: 14px;
  min-width: min-content;
}

.new-music-card {
  flex-shrink: 0;
  width: 150px;
  cursor: pointer;
  transition: all var(--transition);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.new-music-card:hover {
  transform: translateY(-4px);
}

.nm-card-cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-tertiary);
}

.nm-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.new-music-card:hover .nm-card-cover img {
  transform: scale(1.08);
}

.nm-card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
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
  font-size: 42px;
  color: white;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
}

.nm-card-corner {
  position: absolute;
  top: 6px;
  left: 6px;
  background: var(--accent);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.nm-card-info {
  padding: 10px 2px;
}

.nm-card-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nm-card-artist {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
