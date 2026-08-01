<template>
  <SwitchRoot
    class="switch-root"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SwitchThumb class="switch-thumb" />
  </SwitchRoot>
</template>

<script setup>
import { SwitchRoot, SwitchThumb } from 'reka-ui';

defineProps({
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
</script>

<style scoped>
.switch-root {
  all: unset;
  width: 44px;
  height: 24px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: all var(--transition);
  flex-shrink: 0;
}

.switch-root[data-state='checked'] {
  background: var(--accent);
  border-color: var(--accent);
}

.switch-thumb {
  display: block;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 999px;
  transition: transform var(--transition);
  transform: translateX(2px);
  will-change: transform;
}

.switch-root[data-state='checked'] .switch-thumb {
  transform: translateX(24px);
}
</style>
