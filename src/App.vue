<script setup lang="ts">
import { useLiveStrategyData } from '@/composables/useLiveStrategyData'
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery'
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
const selectedStrategyValue = computed(() => selectedStrategy.value?.value ?? null)

const logScale = ref(false)
const isMobile = useMediaQuery(MOBILE_QUERY)

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
    <header class="header">
      <span class="header-logo">ChartLab</span>
      <span class="header-badge">v0.1</span>
    </header>

    <section class="content">
      <div class="sidebar">
        <div v-if="symbolsLoading" class="status">
          <LoadingSpinner />
        </div>

        <div v-else-if="symbolsError" class="status error">
          Failed to load symbols: {{ symbolsError }}
        </div>

        <template v-else>
          <div class="sidebar-section">
            <h3 class="section-title">Symbols</h3>
            <SymbolSelector v-model="selectedSymbol" :symbols="symbols" />
          </div>

          <div class="sidebar-divider"></div>

          <div class="sidebar-section">
            <h3 class="section-title">Strategies</h3>
            <div v-if="strategiesLoading" class="status">
              <LoadingSpinner />
            </div>
            <div v-else-if="strategiesError" class="status error">
              Failed to load strategies: {{ strategiesError }}
            </div>
            <StrategieSelector
              v-else
              v-model="selectedStrategy"
              :strategies="strategies"
              :disabled="!selectedSymbol"
            />
          </div>

          <div class="sidebar-divider"></div>

          <label class="toggle-row">
            <input type="checkbox" v-model="logScale" />
            <span>Log scale</span>
          </label>
        </template>
      </div>

      <div class="chart-area">
        <div v-if="!selectedSymbol" class="status">Please select a symbol from the left panel.</div>

        <div v-else-if="stockLoading || strategieLoading" class="status">
          <LoadingSpinner />
        </div>

        <div v-else-if="stockError || strategieError" class="status error">
          {{ stockError || strategieError }}
        </div>

        <BaseStockChart
          v-else-if="!selectedStrategy"
          :key="selectedSymbol.value"
          :symbol="selectedSymbol.label"
          :data="stockData"
          :log-scale="logScale"
          :compact="isMobile"
        />

        <SmaStockChart
          v-else-if="selectedStrategy.value === 'sma' && finalSmaData"
          :key="selectedSymbol.value"
          :symbol="selectedSymbol.label"
          :data="finalSmaData"
          :log-scale="logScale"
          :compact="isMobile"
        />

        <div v-else class="status">
          Strategy <strong>{{ selectedStrategy.label }}</strong> not supported yet.
        </div>
      </div>
    </section>
  </main>
</template>
