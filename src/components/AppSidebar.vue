<script setup>
import { Icon } from '@iconify/vue';

defineProps({
  canGoBack: { type: Boolean, required: true },
  playlistCount: { type: Number, required: true },
});

const emit = defineEmits(['go-back']);
</script>

<template>
  <aside class="sidebar">
    <button class="nav-back" :disabled="!canGoBack" title="返回" @click="emit('go-back')">
      <Icon icon="mdi:chevron-left" />
    </button>
    <nav class="sidebar-nav">
      <router-link to="/home" class="nav-item" active-class="active">
        <Icon icon="mdi:fire" class="nav-icon" />
        <span class="nav-text">推荐</span>
      </router-link>
      <router-link to="/playlist" class="nav-item" active-class="active">
        <Icon icon="mdi:playlist-music" class="nav-icon" />
        <span class="nav-text">播放列表</span>
        <span v-if="playlistCount" class="nav-badge">{{ playlistCount }}</span>
      </router-link>
      <router-link to="/fav" class="nav-item" active-class="active">
        <Icon icon="mdi:star-outline" class="nav-icon" />
        <span class="nav-text">收藏夹</span>
      </router-link>
    </nav>
    <div class="sidebar-spacer" />
    <nav class="sidebar-nav sidebar-nav-bottom">
      <router-link to="/settings" class="nav-item" active-class="active">
        <Icon icon="mdi:cog-outline" class="nav-icon" />
        <span class="nav-text">设置</span>
      </router-link>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background: rgba(15, 15, 26, 0.6);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 12px 0;
  align-items: center;
}

.nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0 0 10px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition);
  font-size: 28px;
  flex-shrink: 0;
}

.nav-back:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-back:active:not(:disabled) {
  transform: scale(0.9);
}

.nav-back:disabled {
  opacity: 0.25;
  cursor: default;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 0 8px;
}

.sidebar-spacer {
  flex: 1;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition);
  font-size: 10px;
  text-decoration: none;
  position: relative;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.nav-item.active {
  background: var(--accent-dim);
  color: var(--accent);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--accent);
  border-radius: 0 3px 3px 0;
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-text {
  font-size: 10px;
  line-height: 1;
  font-weight: 500;
}

.nav-badge {
  position: absolute;
  top: 2px;
  right: 6px;
  background: var(--accent);
  color: var(--bg-deep);
  font-size: 9px;
  font-weight: 700;
  min-width: 16px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}
</style>
