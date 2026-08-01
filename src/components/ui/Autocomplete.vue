<template>
  <AutocompleteRoot
    class="autocomplete-root"
    :model-value="modelValue"
    :open="open"
    :open-on-focus="true"
    :open-on-click="true"
    :ignore-filter="true"
    @update:open="emit('update:open', $event)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <AutocompleteAnchor class="search-bar">
      <Icon icon="mdi:magnify" class="search-bar-icon" />
      <AutocompleteInput :placeholder="placeholder" class="search-input" v-on="listeners" />
      <AutocompleteCancel v-if="modelValue" as-child>
        <button class="search-clear" @click="emit('update:modelValue', '')">
          <Icon icon="mdi:close-circle" />
        </button>
      </AutocompleteCancel>
    </AutocompleteAnchor>
    <AutocompletePortal>
      <AutocompleteContent
        class="search-dropdown"
        position="popper"
        :side-offset="6"
        :hide-when-empty="false"
      >
        <AutocompleteViewport class="sd-viewport">
          <template v-for="(group, gi) in groups" :key="gi">
            <AutocompleteGroup>
              <AutocompleteLabel class="sd-title" :class="{ 'sd-title-row': group.clearable }">
                <span>{{ group.label }}</span>
                <button v-if="group.clearable" class="sd-clear-btn" @click="emit('clear-history')">
                  清空
                </button>
              </AutocompleteLabel>
              <AutocompleteItem
                v-for="(item, ii) in group.items"
                :key="ii"
                :value="item.value"
                class="sd-item"
                @select="emit('select', item.value)"
              >
                <Icon v-if="item.icon" :icon="item.icon" class="sd-item-icon" />
                <span
                  v-if="item.rank != null"
                  class="sd-rank"
                  :class="{ 'sd-rank-top': item.rank <= 3 }"
                  >{{ item.rank }}</span
                >
                <span>{{ item.label }}</span>
              </AutocompleteItem>
            </AutocompleteGroup>
          </template>
          <AutocompleteEmpty class="sd-empty">暂无数据</AutocompleteEmpty>
        </AutocompleteViewport>
      </AutocompleteContent>
    </AutocompletePortal>
  </AutocompleteRoot>
</template>

<script setup>
import {
  AutocompleteRoot,
  AutocompleteAnchor,
  AutocompleteInput,
  AutocompleteCancel,
  AutocompletePortal,
  AutocompleteContent,
  AutocompleteViewport,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteLabel,
  AutocompleteItem,
} from 'reka-ui';
import { Icon } from '@iconify/vue';
import { useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

defineProps({
  modelValue: { type: String, default: '' },
  open: { type: Boolean, default: false },
  placeholder: { type: String, default: '搜索...' },
  groups: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'update:open', 'select', 'clear-history']);

const attrs = useAttrs();
const listeners = {};
for (const key of Object.keys(attrs)) {
  if (key.startsWith('on')) listeners[key] = attrs[key];
}
</script>

<style>
.autocomplete-root {
  width: 100%;
  max-width: 420px;
}

.search-bar {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 0 16px;
  transition: border-color var(--transition);
}

.search-bar:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.search-bar-icon {
  font-size: 18px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 10px 12px;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  transition: color var(--transition);
  flex-shrink: 0;
}

.search-clear:hover {
  color: var(--text-primary);
}

.search-dropdown {
  width: var(--reka-autocomplete-trigger-width);
  max-height: 420px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px var(--shadow);
  z-index: 100;
  overflow: hidden;
  min-width: 420px;
}

.sd-viewport {
  max-height: 400px;
  overflow-y: auto;
  padding: 6px 0;
}

.sd-title {
  font-size: 11px;
  color: var(--text-muted);
  padding: 6px 14px 4px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.sd-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sd-clear-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  text-transform: none;
  letter-spacing: normal;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all var(--transition);
}

.sd-clear-btn:hover {
  color: var(--danger);
  background: rgba(255, 71, 87, 0.1);
}

.sd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: background var(--transition);
  outline: none;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  font-family: inherit;
}

.sd-item:hover,
.sd-item[data-highlighted] {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sd-item-icon {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.5;
}

.sd-item span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sd-rank {
  width: 16px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-align: left;
  flex-shrink: 0;
  margin-right: 2px;
}

.sd-rank-top {
  color: var(--accent);
}

.sd-empty {
  padding: 24px 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
