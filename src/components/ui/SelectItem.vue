<template>
  <SelectItem v-bind="$attrs">
    <slot />
  </SelectItem>
</template>

<script setup>
import { SelectItem } from 'reka-ui';
</script>
