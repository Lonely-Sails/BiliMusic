<template>
  <SelectRoot :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <SelectTrigger class="setting-select-trigger">
      <SelectValue :placeholder="placeholder" />
      <Icon icon="mdi:chevron-down" class="select-chevron" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="select-content" side="bottom" align="end">
        <SelectViewport>
          <slot>
            <SelectItem v-for="item in items" :key="item.value" :value="item.value">
              <SelectItemText>{{ item.label }}</SelectItemText>
            </SelectItem>
            <SelectSeparator v-if="items.length" class="select-separator" />
            <SelectItem v-if="noneOption" value="__none__">
              <SelectItemText class="text-muted">{{ noneLabel }}</SelectItemText>
            </SelectItem>
          </slot>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup>
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectSeparator,
} from 'reka-ui';
import { Icon } from '@iconify/vue';

defineProps({
  modelValue: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  placeholder: { type: String, default: '选择...' },
  noneOption: { type: Boolean, default: false },
  noneLabel: { type: String, default: '不使用' },
});

const emit = defineEmits(['update:modelValue']);
</script>

<style>
.setting-select-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  min-width: 180px;
  justify-content: space-between;
  transition: border-color var(--transition);
  font-family: inherit;
}

.setting-select-trigger:hover {
  border-color: var(--accent-dim);
}

.select-chevron {
  font-size: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.select-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px var(--shadow);
  z-index: 100;
  max-height: 300px;
  overflow: hidden;
}

.select-content [data-reka-collection-item] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  outline: none;
  transition: background var(--transition);
}

.select-content [data-reka-collection-item]:hover,
.select-content [data-reka-collection-item][data-highlighted] {
  background: var(--bg-hover);
}

.select-content [data-reka-collection-item][data-state='checked'] {
  color: var(--accent);
}

.select-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
}
</style>
