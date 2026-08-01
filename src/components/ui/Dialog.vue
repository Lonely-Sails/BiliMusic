<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <slot name="trigger" />
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent class="dialog-content">
        <DialogClose class="dialog-close-btn" as-child>
          <slot name="close">
            <Icon icon="mdi:close" />
          </slot>
        </DialogClose>
        <div class="dialog-body">
          <DialogTitle v-if="title" class="dialog-title">{{ title }}</DialogTitle>
          <DialogDescription v-if="description" class="dialog-desc">{{
            description
          }}</DialogDescription>
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from 'reka-ui';
import { Icon } from '@iconify/vue';

defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);
</script>

<style>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.dialog-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 0;
  min-width: 340px;
  max-width: 400px;
  z-index: 1001;
  animation: dialogIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  box-shadow: 0 24px 64px var(--shadow);
}

.dialog-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--transition);
}

.dialog-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dialog-body {
  padding: 32px;
}

.dialog-title {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4px;
}

.dialog-desc {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 28px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.92) translateY(8px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) translateY(0);
  }
}
</style>
