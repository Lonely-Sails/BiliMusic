<template>
  <Separator :orientation="orientation" class="separator" />
</template>

<script setup>
import { Separator } from 'reka-ui';

defineProps({
  orientation: { type: String, default: 'horizontal' },
});
</script>

<style>
.separator {
  border: none;
  margin: 0;
  flex-shrink: 0;
}

.separator[data-orientation='horizontal'] {
  height: 1px;
  background: var(--border);
}

.separator[data-orientation='vertical'] {
  width: 1px;
  height: auto;
  align-self: stretch;
  background: var(--border);
}
</style>
