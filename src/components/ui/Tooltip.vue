<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent :side="side" class="tooltip-content" :data-state="'instant-open'">
        {{ text }}
        <TooltipArrow class="tooltip-arrow" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<script setup>
import { TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent, TooltipArrow } from 'reka-ui'

defineProps({
  text: { type: String, required: true },
  side: { type: String, default: 'top' }
})
</script>

<style>
.tooltip-content {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 4px 16px var(--shadow);
  z-index: 2000;
  animation: tooltipIn 0.15s ease;
}

.tooltip-arrow {
  fill: var(--bg-tertiary);
}

@keyframes tooltipIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
