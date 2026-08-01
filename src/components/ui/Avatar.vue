<template>
  <AvatarRoot class="avatar-root" :style="{ width: size + 'px', height: size + 'px' }">
    <AvatarImage v-if="src" class="avatar-image" :src="src" :alt="alt" />
    <AvatarFallback class="avatar-fallback" :style="{ fontSize: size * 0.5 + 'px' }">
      <slot name="fallback">
        <Icon icon="mdi:account" />
      </slot>
    </AvatarFallback>
  </AvatarRoot>
</template>

<script setup>
import { AvatarRoot, AvatarImage, AvatarFallback } from 'reka-ui';
import { Icon } from '@iconify/vue';

defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  size: { type: Number, default: 32 },
});
</script>

<style>
.avatar-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-muted);
}
</style>
