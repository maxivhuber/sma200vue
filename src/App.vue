<script setup lang="ts">
import { useStockData } from '@/composables/useStockData'
import { useStrategies } from '@/composables/useStrategies'
import { useSymbols } from '@/composables/useSymbols'
import { ref } from 'vue'
import LoadingSpinner from './components/LoadingSpinner.vue'
import StockChart from './components/StockChart.vue'
import StrategieSelector from './components/StrategieSelector.vue'
import SymbolSelector from './components/SymbolSelector.vue'

const { symbols, loading: symbolsLoading, error: symbolsError } = useSymbols()

const { strategies, loading: strategiesLoading, error: strategiesError } = useStrategies()

const selectedSymbol = ref<string | null>(null)
const selectedStrategy = ref<string | null>(null)
const logScale = ref(false)

const { data: stockData, loading: dataLoading, error: dataError } = useStockData(selectedSymbol)
</script>

<template>
  <main class="app">
    <header class="panel header">
      <h2>Stock Chart App</h2>
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
              <StrategieSelector v-model="selectedStrategy" :strategies="strategies" />
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

        <div v-else-if="dataLoading" class="status">
          <LoadingSpinner />
        </div>

        <div v-else-if="dataError" class="status error">Error loading data: {{ dataError }}</div>

        <StockChart v-else :symbol="selectedSymbol" :data="stockData" :log-scale="logScale" />
      </div>
    </section>
  </main>
</template>
