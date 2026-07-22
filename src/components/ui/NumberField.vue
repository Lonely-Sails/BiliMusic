<template>
  <NumberFieldRoot class="number-field" :model-value="modelValue" :min="min" :max="max" :step="step" v-bind="$attrs"
    @update:model-value="emit('update:modelValue', $event)">
    <NumberFieldDecrement class="nf-btn">
      <Icon icon="mdi:minus" />
    </NumberFieldDecrement>
    <NumberFieldInput class="nf-input" />
    <NumberFieldIncrement class="nf-btn">
      <Icon icon="mdi:plus" />
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>

<script setup>
import { NumberFieldRoot, NumberFieldInput, NumberFieldDecrement, NumberFieldIncrement } from 'reka-ui'
import { Icon } from '@iconify/vue'

defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 }
})

const emit = defineEmits(['update:modelValue'])
</script>

<style scoped>
.number-field {
  display: inline-flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-tertiary);
}

.nf-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition);
}

.nf-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nf-input {
  width: 48px;
  height: 28px;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.nf-input::-webkit-outer-spin-button,
.nf-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
