<script setup>
import { Icon } from '@iconify/vue';
import Autocomplete from './ui/Autocomplete.vue';
import LoginPanel from './LoginPanel.vue';

defineProps({
  isMac: { type: Boolean, required: true },
  isMaximized: { type: Boolean, required: true },
  searchQuery: { type: String, required: true },
  searchOpen: { type: Boolean, required: true },
  autocompleteGroups: { type: Array, required: true },
});

const emit = defineEmits([
  'update:searchQuery',
  'update:searchOpen',
  'search-input',
  'search',
  'select-suggestion',
  'clear-history',
  'minimize',
  'maximize',
  'close',
]);

function handleSearchInput(value) {
  emit('update:searchQuery', value);
  emit('search-input');
}
</script>

<template>
  <header class="app-header" :class="{ 'is-mac': isMac }">
    <div v-if="!isMac" class="window-controls">
      <button class="window-button window-button-minimize" title="最小化" @click="emit('minimize')">
        <Icon icon="mdi:window-minimize" />
      </button>
      <button
        class="window-button"
        :title="isMaximized ? '还原' : '最大化'"
        @click="emit('maximize')"
      >
        <Icon :icon="isMaximized ? 'mdi:window-restore' : 'mdi:window-maximize'" />
      </button>
      <button class="window-button window-button-close" title="关闭" @click="emit('close')">
        <Icon icon="mdi:close" />
      </button>
    </div>

    <div class="header-left drag-region">
      <div class="logo">
        <Icon icon="mdi:music-note" class="logo-icon" />
        <span class="logo-text">BiliMusic</span>
      </div>
    </div>

    <div class="drag-region header-center search-wrapper">
      <Autocomplete
        :model-value="searchQuery"
        :open="searchOpen"
        placeholder="搜索B站音乐..."
        :groups="autocompleteGroups"
        @update:model-value="handleSearchInput"
        @update:open="emit('update:searchOpen', $event)"
        @keyup.enter="emit('search')"
        @select="emit('select-suggestion', $event)"
        @clear-history="emit('clear-history')"
      />
    </div>

    <div class="header-right">
      <LoginPanel />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  height: var(--header-height);
  padding: 0 20px;
  background: var(--bg-elevated);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  gap: 20px;
  flex-shrink: 0;
  z-index: 10;
  -webkit-app-region: drag;
}

.app-header.is-mac {
  padding-left: 80px;
}

.drag-region {
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 140px;
  padding-left: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 4px;
}

.logo-icon {
  font-size: 26px;
  color: var(--accent);
}

.logo-text {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1.5px;
  background: linear-gradient(135deg, var(--accent) 0%, #00a1d6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  -webkit-app-region: drag;
}

/* 搜索栏本体不可拖动（可交互），但两侧空白保留可拖动 */
:deep(.autocomplete-root) {
  -webkit-app-region: no-drag;
}

.header-right {
  min-width: 140px;
  display: flex;
  justify-content: flex-end;
  -webkit-app-region: no-drag;
}

.window-controls {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  margin-left: -20px;
  height: var(--header-height);
}

.window-button {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition:
    background 0.15s,
    color 0.15s;
  -webkit-app-region: no-drag;
}

.window-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.window-button-close:hover {
  background: #e81123;
  color: #fff;
}

.window-button svg {
  display: block;
  width: 14px;
  height: 14px;
}

.window-button-minimize svg {
  width: 12px;
  height: 12px;
}
</style>
