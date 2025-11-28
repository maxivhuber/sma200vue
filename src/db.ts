import type { StockDataPoint } from '@/composables/useStockData'
import type { SMAResponse } from '@/composables/useStrategieData'
import Dexie, { type EntityTable } from 'dexie'

export type CachedData = StockDataPoint[] | SMAResponse

export interface CachedSeries {
  id: string
  data: CachedData
  expireAt: number
}

const db = new Dexie('StockDatabase') as Dexie & {
  stockdata: EntityTable<CachedSeries, 'id'>
}

db.version(1).stores({
  stockdata: 'id, expireAt',
})

export { db }
