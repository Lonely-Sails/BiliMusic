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
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.scrollarea-viewport {
  width: 100%;
  height: 100%;
  overflow: auto;
  scrollbar-width: none;
}
.scrollarea-viewport::-webkit-scrollbar {
  display: none;
}

.scrollarea-scrollbar {
  display: flex;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;
  padding: 1px 0;
  z-index: 10;
}

.scrollarea-scrollbar[data-orientation="horizontal"] {
  flex-direction: row;
  bottom: 0;
  left: 0;
  right: 0;
  top: auto;
  width: auto;
  height: 6px;
  padding: 0 1px;
}

.scrollarea-thumb {
  flex: 1;
  background: var(--border);
  border-radius: 3px;
}

.scrollarea-scrollbar[data-orientation="vertical"] .scrollarea-thumb {
  min-height: 40px;
}

.scrollarea-scrollbar[data-orientation="horizontal"] .scrollarea-thumb {
  min-width: 40px;
}

.scrollarea-thumb:hover {
  background: var(--text-muted);
}

.scrollarea-corner {
  background: transparent;
}
</style>
