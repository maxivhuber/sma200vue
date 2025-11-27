import type { StockDataPoint } from '@/composables/useStockData'
import Dexie, { type EntityTable } from 'dexie'

interface CachedSeries {
  id: string
  data: StockDataPoint[]
  expireAt: number
}

const db = new Dexie('StockDatabase') as Dexie & {
  stockdata: EntityTable<CachedSeries, 'id'>
}

db.version(1).stores({
  stockdata: 'id, expireAt',
})

export { db }
export type { CachedSeries }
