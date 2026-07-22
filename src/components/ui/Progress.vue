<template>
  <ProgressRoot :model-value="modelValue" :max="max" class="progress-root">
    <ProgressIndicator class="progress-indicator" />
  </ProgressRoot>
</template>

<script setup>
import { ProgressRoot, ProgressIndicator } from 'reka-ui'

defineProps({
  modelValue: { type: Number, default: 0 },
  max: { type: Number, default: 100 }
})
</script>

<style>
.progress-root {
  position: relative;
  width: 100%;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 4px;
  overflow: hidden;
}

.progress-indicator {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width var(--transition);
}
</style>
