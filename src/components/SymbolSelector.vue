<script setup lang="ts">
import type { LabeledItem } from '@/types/LabeledItem'

defineProps<{ symbols: LabeledItem[] }>()
const selected = defineModel<LabeledItem | null>({ required: true })
</script>

<template>
  <ul v-if="symbols.length" class="selector-list" aria-label="Symbols">
    <li v-for="symbol in symbols" :key="symbol.value">
      <button
        type="button"
        class="selector-item"
        :class="{ active: symbol.value === selected?.value }"
        :aria-pressed="symbol.value === selected?.value"
        :title="symbol.label"
        @click="selected = symbol"
      >
        <span class="selector-label">{{ symbol.label }}</span>
        <span class="selector-value">{{ symbol.value }}</span>
      </button>
    </li>
  </ul>
  <p v-else class="status">No symbols available.</p>
</template>
