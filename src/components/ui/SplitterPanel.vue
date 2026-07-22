<template>
  <SplitterPanel class="splitter-panel" v-bind="$attrs">
    <slot />
  </SplitterPanel>
</template>

<script setup>
import { SplitterPanel } from 'reka-ui'
</script>

<style scoped>
.splitter-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
