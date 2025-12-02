<script setup lang="ts">
import { computed, ref } from 'vue'

import { useLiveStrategyData } from '@/composables/useLiveStrategyData'
import { mergeSmaData } from '@/composables/useSmaMerge'
import { useStockData } from '@/composables/useStockData'
import { useStrategieData } from '@/composables/useStrategieData'
import { useStrategies } from '@/composables/useStrategies'
import { useSymbols } from '@/composables/useSymbols'

import BaseStockChart from './components/BaseStockChart.vue'
import LoadingSpinner from './components/LoadingSpinner.vue'
import SmaStockChart from './components/SmaStockChart.vue'
import StrategieSelector from './components/StrategieSelector.vue'
import SymbolSelector from './components/SymbolSelector.vue'

const selectedSymbol = ref<string | null>(null)
const selectedStrategy = ref<string | null>(null)
const logScale = ref(false)

const { symbols, loading: symbolsLoading, error: symbolsError } = useSymbols()
const { strategies, loading: strategiesLoading, error: strategiesError } = useStrategies()
const { data: stockData, loading: stockLoading, error: stockError } = useStockData(selectedSymbol)
const {
  data: strategieData,
  loading: strategieLoading,
  error: strategieError,
} = useStrategieData(selectedSymbol, selectedStrategy)

const { liveData } = useLiveStrategyData(selectedSymbol, selectedStrategy)

const finalSmaData = computed(() => {
  if (selectedStrategy.value !== 'sma') return null
  if (!liveData.value) return strategieData.value
  return mergeSmaData(strategieData.value, liveData.value)
})
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
          <SymbolSelector v-model="selectedSymbol" :symbols="symbols" />
          <hr class="panel-separator" />

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

          <ul class="symbol-list">
            <li>
              <label class="log-toggle">
                <input type="checkbox" v-model="logScale" />
                <span>Log scale</span>
              </label>
            </li>
          </ul>
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
          v-else-if="selectedSymbol && !selectedStrategy"
          :symbol="selectedSymbol"
          :strategie="null"
          :data="stockData"
          :log-scale="logScale"
        />

        <SmaStockChart
          v-else-if="selectedSymbol && selectedStrategy === 'sma' && finalSmaData"
          :symbol="selectedSymbol"
          :data="finalSmaData"
          :log-scale="logScale"
        />

        <div v-else>
          Strategy <strong>{{ selectedStrategy }}</strong> not supported yet.
        </div>
      </div>
    </section>
  </main>
</template>
