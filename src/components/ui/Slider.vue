<template>
  <SliderRoot
    :model-value="modelValue"
    :max="max"
    :step="step"
    :disabled="disabled"
    :orientation="orientation"
    :class="['slider-root', rootClass]"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SliderTrack :class="['slider-track', trackClass]">
      <SliderRange :class="['slider-range', rangeClass]" />
    </SliderTrack>
    <SliderThumb :class="['slider-thumb', thumbClass]" />
  </SliderRoot>
</template>

<script setup>
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui';

defineProps({
  modelValue: { type: Array, default: () => [0] },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
  orientation: { type: String, default: 'horizontal' },
  rootClass: { type: String, default: '' },
  trackClass: { type: String, default: '' },
  rangeClass: { type: String, default: '' },
  thumbClass: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);
</script>

<style scoped>
.slider-root {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.slider-root[data-orientation='horizontal'] {
  width: 100%;
  height: 20px;
}

.slider-root[data-orientation='vertical'] {
  flex-direction: column;
  width: 20px;
  height: 100%;
}

.slider-track {
  position: relative;
  flex-grow: 1;
  background: var(--bg-hover);
  border-radius: 4px;
}

.slider-track[data-orientation='horizontal'] {
  height: 4px;
}

.slider-track[data-orientation='vertical'] {
  width: 4px;
}

.slider-range {
  position: absolute;
  background: linear-gradient(90deg, var(--accent), #00a1d6);
  border-radius: 4px;
}

.slider-range[data-orientation='horizontal'] {
  height: 100%;
}

.slider-range[data-orientation='vertical'] {
  width: 100%;
}

.slider-thumb {
  display: block;
  width: 14px;
  height: 14px;
  background: white;
  border: 2px solid var(--accent);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s;
  cursor: grab;
  box-shadow: 0 1px 4px var(--shadow);
  z-index: 1;
  flex-shrink: 0;
}

.slider-root:hover .slider-thumb,
.slider-thumb:focus-visible {
  opacity: 1;
}
</style>
