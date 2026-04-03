<script setup lang="ts">
import type { LabeledItem } from '@/types/LabeledItem'
import { computed } from 'vue'

const props = defineProps<{
  symbols: LabeledItem[]
  modelValue?: LabeledItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LabeledItem | null]
}>()

const selected = computed(() => props.modelValue ?? null)

function setSelected(item: LabeledItem) {
  emit('update:modelValue', item)
}
</script>

<template>
  <ul v-if="symbols.length" class="selector-list">
    <li
      v-for="symbol in symbols"
      :key="symbol.value"
      @click="setSelected(symbol)"
      class="selector-item"
      :class="{ active: symbol.value === selected?.value }"
    >
      <span class="selector-label">{{ symbol.label }}</span>
      <span class="selector-value">{{ symbol.value }}</span>
    </li>
  </ul>
  <p v-else class="status">No symbols available.</p>
</template>
