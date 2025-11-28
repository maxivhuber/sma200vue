<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  symbols: string[]
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
  <div class="symbol-selector">
    <p v-if="!symbols.length" class="status">No symbols available.</p>

    <ul v-else class="symbol-list">
      <li
        v-for="symbol in symbols"
        :key="symbol"
        @click="selected = symbol"
        :class="{ selected: symbol === selected }"
      >
        {{ symbol }}
      </li>
    </ul>
  </div>
</template>
