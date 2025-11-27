<script setup lang="ts">
import { useStockData } from '@/composables/useStockData'
import { useSymbols } from '@/composables/useSymbols'
import { ref } from 'vue'
import LoadingSpinner from './components/LoadingSpinner.vue'
import StockChart from './components/StockChart.vue'
import SymbolSelector from './components/SymbolSelector.vue'

const { symbols, loading, error } = useSymbols()
const selectedSymbol = ref<string | null>(null)
const { data: stockData, loading: dataLoading, error: dataError } = useStockData(selectedSymbol)
const logScale = ref(false)
</script>

<template>
  <main class="app">
    <header class="panel header">
      <h2>Stock Chart App</h2>
    </header>
    <section class="content">
      <div class="panel symbol-panel">
        <div v-if="loading" class="status"><LoadingSpinner /></div>
        <div v-else-if="error" class="status error">Failed to load symbols: {{ error }}</div>
        <div v-else class="symbol-selector">
          <SymbolSelector v-model="selectedSymbol" :symbols="symbols" />
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
        <div v-else-if="dataLoading" class="status"><LoadingSpinner /></div>
        <div v-else-if="dataError" class="status error">Error loading data: {{ dataError }}</div>
        <StockChart v-else :symbol="selectedSymbol" :data="stockData" :log-scale="logScale" />
      </div>
    </section>
  </main>
</template>
