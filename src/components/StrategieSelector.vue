<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  strategies: { value: string; label: string }[]
  modelValue?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
}>()

const selected = ref<string | null>(props.modelValue ?? null)

watch(
  () => props.modelValue,
  (v) => (selected.value = v ?? null),
)

watch(selected, (v) => emit('update:modelValue', v))
</script>

<template>
  <div class="symbol-selector strategy-selector">
    <p v-if="!strategies.length" class="status">No strategies available.</p>

    <ul v-else class="symbol-list strategy-list">
      <li
        v-for="strategy in strategies"
        :key="strategy.value"
        @click="selected = selected === strategy.value ? null : strategy.value"
        :class="{ selected: strategy.value === selected }"
      >
        {{ strategy.label }}
      </li>
    </ul>
  </div>
</template>
