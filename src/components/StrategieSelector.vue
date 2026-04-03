<script setup lang="ts">
import type { LabeledItem } from '@/types/LabeledItem'
import { computed } from 'vue'

const props = defineProps<{
  strategies: LabeledItem[]
  modelValue?: LabeledItem | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LabeledItem | null]
}>()

const selected = computed(() => props.modelValue ?? null)

function toggle(item: LabeledItem) {
  if (selected.value?.value === item.value) {
    emit('update:modelValue', null)
  } else {
    emit('update:modelValue', item)
  }
}
</script>

<template>
  <ul v-if="strategies.length" class="selector-list">
    <li
      v-for="strategy in strategies"
      :key="strategy.value"
      @click="!disabled && toggle(strategy)"
      class="selector-item"
      :class="{ active: strategy.value === selected?.value, disabled }"
    >
      <span class="selector-label">{{ strategy.label }}</span>
    </li>
  </ul>
  <p v-else class="status">No strategies available.</p>
</template>
