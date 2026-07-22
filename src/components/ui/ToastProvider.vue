<template>
  <ToastProvider>
    <slot />
    <ToastViewport class="toast-viewport" />
  </ToastProvider>
</template>

<script setup>
import { ToastProvider, ToastViewport } from 'reka-ui'
</script>

<style>
.toast-viewport {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
  outline: none;
  list-style: none;
  pointer-events: none;
}
</style>
