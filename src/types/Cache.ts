import type { SMAResponse } from './SMA'
import type { StockDataPoint } from './StockDataPoint'

export interface CachedStockSeries {
  id: string
  type: 'stock'
  data: StockDataPoint[]
  expireAt: number
}

export interface CachedStrategySeries {
  id: string
  type: 'strategy'
  data: SMAResponse
  expireAt: number
}

export type CachedSeries = CachedStockSeries | CachedStrategySeries
