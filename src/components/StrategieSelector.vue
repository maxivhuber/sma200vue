<script setup lang="ts">
import type { LabeledItem } from '@/types/LabeledItem'
import { ref, watch } from 'vue'

const props = defineProps<{
  strategies: LabeledItem[]
  modelValue?: LabeledItem | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LabeledItem | null]
}>()

const selected = ref<LabeledItem | null>(props.modelValue ?? null)

watch(
  () => props.modelValue,
  (v) => (selected.value = v ?? null),
)

function toggle(item: LabeledItem) {
  if (selected.value?.value === item.value) {
    selected.value = null
    emit('update:modelValue', null)
  } else {
    selected.value = item
    emit('update:modelValue', item)
  }
}
</script>

<template>
  <div class="symbol-selector strategy-selector">
    <p v-if="!strategies.length" class="status">No strategies available.</p>

    <ul v-else class="symbol-list strategy-list">
      <li
        v-for="strategy in strategies"
        :key="strategy.value"
        @click="!disabled && toggle(strategy)"
        :class="{ selected: strategy.value === selected?.value, disabled }"
      >
        {{ strategy.label }}
      </li>
    </ul>
  </div>
</template>
