<script setup lang="ts">
import { useLiveStrategyData } from '@/composables/useLiveStrategyData'
import { mergeSmaData } from '@/composables/useSmaMerge'
import { useStockData } from '@/composables/useStockData'
import { useStrategieData } from '@/composables/useStrategieData'
import { useStrategies } from '@/composables/useStrategies'
import { useSymbols } from '@/composables/useSymbols'
import { computed, ref } from 'vue'

import BaseStockChart from './components/BaseStockChart.vue'
import LoadingSpinner from './components/LoadingSpinner.vue'
import SmaStockChart from './components/SmaStockChart.vue'
import StrategieSelector from './components/StrategieSelector.vue'
import SymbolSelector from './components/SymbolSelector.vue'

import type { LabeledItem } from './types/LabeledItem'

const selectedSymbol = ref<LabeledItem | null>(null)
const selectedStrategy = ref<LabeledItem | null>(null)

const selectedSymbolValue = computed(() => selectedSymbol.value?.value ?? null)
const selectedSymbolLabel = computed(() => selectedSymbol.value?.label ?? null)

const selectedStrategyValue = computed(() => selectedStrategy.value?.value ?? null)
const selectedStrategyLabel = computed(() => selectedStrategy.value?.label ?? null)

const logScale = ref(false)

const { symbols, loading: symbolsLoading, error: symbolsError } = useSymbols()
const { strategies, loading: strategiesLoading, error: strategiesError } = useStrategies()

const {
  data: stockData,
  loading: stockLoading,
  error: stockError,
} = useStockData(selectedSymbolValue)

const {
  data: strategieData,
  loading: strategieLoading,
  error: strategieError,
} = useStrategieData(selectedSymbolValue, selectedStrategyValue)

const { liveData } = useLiveStrategyData(selectedSymbolValue, selectedStrategyValue)

const finalSmaData = computed(() =>
  selectedStrategyValue.value === 'sma' ? mergeSmaData(strategieData.value, liveData.value) : null,
)
</script>

<template>
  <main class="app">
    <header class="panel header">
      <h2>ChartLab🧪🧫</h2>
    </header>

    <section class="content">
      <div class="panel symbol-panel">
        <div v-if="symbolsLoading" class="status">
          <LoadingSpinner />
        </div>

        <div v-else-if="symbolsError" class="status error">
          Failed to load symbols: {{ symbolsError }}
        </div>

        <div v-else class="symbol-selector">
          <h3 class="panel-title">Symbols</h3>
          <SymbolSelector v-model="selectedSymbol" :symbols="symbols" />

          <hr class="panel-separator" />

          <h3 class="panel-title">Strategies</h3>

          <div class="strategy-section padded-block">
            <div v-if="strategiesLoading" class="status">
              <LoadingSpinner />
            </div>
            <div v-else-if="strategiesError" class="status error">
              Failed to load strategies: {{ strategiesError }}
            </div>
            <div v-else>
              <StrategieSelector
                v-model="selectedStrategy"
                :strategies="strategies"
                :disabled="!selectedSymbol"
              />
            </div>
          </div>

          <hr class="panel-separator" />

          <label class="log-toggle">
            <input type="checkbox" v-model="logScale" />
            <span>Log scale</span>
          </label>
        </div>
      </div>

      <div class="panel chart-area">
        <div v-if="!selectedSymbol" class="status">Please select a symbol from the left panel.</div>

        <div v-else-if="stockLoading || strategieLoading" class="status">
          <LoadingSpinner />
        </div>

        <div v-else-if="stockError || strategieError" class="status error">
          {{ stockError || strategieError }}
        </div>

        <BaseStockChart
          v-else-if="!selectedStrategy"
          :symbol="selectedSymbolLabel!"
          :strategie="null"
          :data="stockData"
          :log-scale="logScale"
        />

        <SmaStockChart
          v-else-if="selectedStrategyValue === 'sma' && finalSmaData"
          :symbol="selectedSymbolLabel!"
          :data="finalSmaData"
          :log-scale="logScale"
        />

        <div v-else>
          Strategy <strong>{{ selectedStrategyLabel }}</strong> not supported yet.
        </div>
      </div>
    </section>
  </main>
</template>
