<script setup lang="ts">
import type { LabeledItem } from '@/types/LabeledItem'

defineProps<{ strategies: LabeledItem[]; disabled?: boolean }>()
const selected = defineModel<LabeledItem | null>({ required: true })

function toggle(item: LabeledItem) {
  selected.value = selected.value?.value === item.value ? null : item
}
</script>

<template>
  <ul v-if="strategies.length" class="selector-list" aria-label="Strategies">
    <li v-for="strategy in strategies" :key="strategy.value">
      <button
        type="button"
        class="selector-item"
        :class="{ active: strategy.value === selected?.value }"
        :aria-pressed="strategy.value === selected?.value"
        :disabled
        @click="toggle(strategy)"
      >
        <span class="selector-label">{{ strategy.label }}</span>
      </button>
    </li>
  </ul>
  <p v-else class="status">No strategies available.</p>
</template>
