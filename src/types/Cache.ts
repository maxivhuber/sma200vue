import type { SMAResponse } from './SMA'
import type { StockDataPoint } from './StockDataPoint'

export type CachedData = StockDataPoint[] | SMAResponse

export interface CachedSeries {
  id: string
  data: CachedData
  expireAt: number
}
