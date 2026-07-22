<template>
  <ScrollAreaRoot class="scrollarea-root" v-bind="attrs">
    <ScrollAreaViewport class="scrollarea-viewport">
      <slot />
    </ScrollAreaViewport>
    <ScrollAreaScrollbar class="scrollarea-scrollbar" :orientation="orientation">
      <ScrollAreaThumb class="scrollarea-thumb" />
    </ScrollAreaScrollbar>
    <ScrollAreaCorner class="scrollarea-corner" />
  </ScrollAreaRoot>
</template>

<script setup>
import { useAttrs } from 'vue'
import { ScrollAreaRoot, ScrollAreaViewport, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner } from 'reka-ui'

defineProps({
  orientation: { type: String, default: 'vertical' }
})

const attrs = useAttrs()
</script>

<style>
.scrollarea-root {
  width: 100%;
  height: 100%;
}

.scrollarea-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.scrollarea-scrollbar {
  display: flex;
  width: 6px;
  padding: 1px 0;
  z-index: 10;
}

.scrollarea-scrollbar[data-orientation="horizontal"] {
  flex-direction: row;
  width: auto;
  height: 6px;
  padding: 0 1px;
}

.scrollarea-thumb {
  flex: 1;
  background: var(--border);
  border-radius: 3px;
  min-height: 40px;
}

.scrollarea-thumb:hover {
  background: var(--text-muted);
}

.scrollarea-corner {
  background: transparent;
}
</style>
