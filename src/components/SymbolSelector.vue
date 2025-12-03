<script setup lang="ts">
import type { LabeledItem } from '@/types/LabeledItem'
import { ref, watch } from 'vue'

const props = defineProps<{
  symbols: LabeledItem[]
  modelValue?: LabeledItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LabeledItem | null]
}>()

const selected = ref<LabeledItem | null>(props.modelValue ?? null)

watch(
  () => props.modelValue,
  (v) => (selected.value = v ?? null),
)

function setSelected(item: LabeledItem) {
  selected.value = item
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
