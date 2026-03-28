import type { CachedSeries } from '@/types/Cache'
import Dexie, { type EntityTable } from 'dexie'

const db = new Dexie('StockDatabase') as Dexie & {
  stockdata: EntityTable<CachedSeries, 'id'>
}

db.version(2).stores({
  stockdata: 'id, expireAt',
})

export { db }
