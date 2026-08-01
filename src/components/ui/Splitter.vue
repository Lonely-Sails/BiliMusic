<template>
  <SplitterGroup class="splitter-group" v-bind="$attrs">
    <slot />
  </SplitterGroup>
</template>

<script setup>
import { SplitterGroup } from 'reka-ui';
</script>

<style scoped>
.splitter-group {
  display: flex;
  height: 100%;
  width: 100%;
}

.splitter-group[data-orientation='horizontal'] {
  flex-direction: row;
}

.splitter-group[data-orientation='vertical'] {
  flex-direction: column;
}

.splitter-group[data-orientation='horizontal'] :deep(.splitter-handle) {
  width: 4px;
  cursor: col-resize;
}

.splitter-group[data-orientation='vertical'] :deep(.splitter-handle) {
  height: 4px;
  cursor: row-resize;
}

.splitter-group[data-orientation='horizontal'] :deep(.splitter-handle::after) {
  width: 1px;
  height: 24px;
}

.splitter-group[data-orientation='vertical'] :deep(.splitter-handle::after) {
  height: 1px;
  width: 24px;
}
</style>
