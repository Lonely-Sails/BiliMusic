<template>
  <ToastRoot :duration="duration" class="toast-root" :class="'toast-' + type"
    @update:model-value="(open) => { if (!open) onClose() }">
    <div class="toast-content">
      <Icon :icon="type === 'error' ? 'mdi:alert-circle' : 'mdi:check-circle'" class="toast-icon" />
      <ToastDescription class="toast-description">{{ message }}</ToastDescription>
    </div>
    <ToastClose class="toast-close" aria-label="关闭">
      <Icon icon="mdi:close" />
    </ToastClose>
  </ToastRoot>
</template>

<script setup>
import { ToastRoot, ToastDescription, ToastClose } from 'reka-ui'
import { Icon } from '@iconify/vue'

defineProps({
  message: { type: String, required: true },
  type: { type: String, default: 'success' },
  duration: { type: Number, default: 3000 },
  onClose: { type: Function, default: () => {} }
})
</script>

<style>
.toast-root {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  min-width: 200px;
  max-width: 360px;
  pointer-events: auto;
}

.toast-root[data-state='open'] {
  animation: toastIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-root[data-state='closed'] {
  animation: toastOut 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-root[data-swipe='end'] {
  animation: toastSwipe 0.1s ease-out;
}

.toast-success {
  background: #1a3a2a;
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.toast-error {
  background: #3a1a1a;
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.toast-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.toast-description {
  flex: 1;
}

.toast-close {
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  font-size: 14px;
  border-radius: 4px;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toastOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
}

@keyframes toastSwipe {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(30px);
  }
}
</style>
