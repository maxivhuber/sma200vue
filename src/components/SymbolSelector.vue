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
  <div class="symbol-selector">
    <p v-if="!symbols.length" class="status">No symbols available.</p>

    <ul v-else class="symbol-list">
      <li
        v-for="symbol in symbols"
        :key="symbol.value"
        @click="setSelected(symbol)"
        :class="{ selected: symbol.value === selected?.value }"
      >
        {{ symbol.label }}
      </li>
    </ul>
  </div>
</template>
