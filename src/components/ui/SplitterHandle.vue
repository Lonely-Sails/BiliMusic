<template>
  <SplitterResizeHandle class="splitter-handle" v-bind="$attrs" />
</template>

<script setup>
import { SplitterResizeHandle } from 'reka-ui'
</script>

<style scoped>
.splitter-handle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--border);
  transition: background var(--transition);
  z-index: 5;
}

.splitter-handle:hover,
.splitter-handle[data-dragging] {
  background: var(--accent);
}

.splitter-handle::after {
  content: '';
  position: absolute;
  border-radius: 2px;
  background: var(--text-muted);
  opacity: 0;
  transition: opacity var(--transition);
}

.splitter-handle:hover::after,
.splitter-handle[data-dragging]::after {
  opacity: 0.5;
}
</style>
