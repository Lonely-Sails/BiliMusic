<template>
  <SliderRoot :model-value="modelValue" :max="max" :step="step" :disabled="disabled"
    :orientation="orientation" class="slider-root"
    @update:model-value="emit('update:modelValue', $event)">
    <SliderTrack class="slider-track">
      <SliderRange class="slider-range" />
    </SliderTrack>
    <SliderThumb class="slider-thumb" />
  </SliderRoot>
</template>

<script setup>
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui'

defineProps({
  modelValue: { type: Array, default: () => [0] },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
  orientation: { type: String, default: 'horizontal' }
})

const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.slider-root {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 20px;
  cursor: pointer;
}

.slider-track {
  position: relative;
  flex-grow: 1;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 4px;
}

.slider-range {
  position: absolute;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #00a1d6);
  border-radius: 4px;
}

.slider-thumb {
  display: block;
  width: 14px;
  height: 14px;
  background: white;
  border: 2px solid var(--accent);
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
  cursor: grab;
  box-shadow: 0 1px 4px var(--shadow);
  z-index: 1;
}

.slider-root:hover .slider-thumb,
.slider-thumb:focus-visible {
  opacity: 1;
}
</style>
