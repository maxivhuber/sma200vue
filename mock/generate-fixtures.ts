import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FIXTURES = join(import.meta.dirname, 'fixtures')
const DAYS = 500
const SYMBOLS = [
  { value: 'AAPL', label: 'Apple Inc.', startPrice: 130 },
  { value: 'MSFT', label: 'Microsoft Corp.', startPrice: 250 },
  { value: 'GOOGL', label: 'Alphabet Inc.', startPrice: 90 },
]

function tradingDays(count: number): string[] {
  const dates: string[] = []
  const d = new Date('2023-01-03')
  while (dates.length < count) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().slice(0, 10))
    }
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function randomWalk(start: number, count: number): number[] {
  const prices = [start]
  for (let i = 1; i < count; i++) {
    const change = (Math.random() - 0.48) * start * 0.02
    prices.push(+(prices[i - 1] + change).toFixed(2))
  }
  return prices
}

function sma(prices: number[], window: number): number[] {
  return prices.map((_, i) => {
    const slice = prices.slice(Math.max(0, i - window + 1), i + 1)
    return +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2)
  })
}

const dates = tradingDays(DAYS)

mkdirSync(FIXTURES, { recursive: true })

writeFileSync(
  join(FIXTURES, 'symbols.json'),
  JSON.stringify(
    SYMBOLS.map(({ value, label }) => ({ value, label })),
    null,
    2,
  ),
)

writeFileSync(
  join(FIXTURES, 'strategies.json'),
  JSON.stringify([{ value: 'sma', label: 'SMA 200' }], null, 2),
)

const history: Record<string, object[]> = {}
const smaData: Record<string, object> = {}

for (const sym of SYMBOLS) {
  const closes = randomWalk(sym.startPrice, DAYS)
  const smaValues = sma(closes, 200)
  const stdDev = 0.05

  history[sym.value] = dates.map((date, i) => ({
    Date: date,
    Open: +(closes[i] * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2),
    High: +(closes[i] * (1 + Math.random() * 0.015)).toFixed(2),
    Low: +(closes[i] * (1 - Math.random() * 0.015)).toFixed(2),
    Close: closes[i],
    'Adj Close': closes[i],
    Volume: Math.floor(50_000_000 + Math.random() * 100_000_000),
  }))

  const upperBand = smaValues.map((v) => +(v * (1 + stdDev)).toFixed(2))
  const lowerBand = smaValues.map((v) => +(v * (1 - stdDev)).toFixed(2))
  const signals = closes.map((price, i) => {
    if (price <= lowerBand[i]) return 'BUY'
    if (price >= upperBand[i]) return 'SELL'
    return 'HOLD'
  })

  smaData[sym.value] = {
    symbol: sym.value,
    strategy: 'sma',
    timestamp: new Date().toISOString(),
    result: {
      dates,
      prices: closes,
      sma: smaValues,
      upper_band: upperBand,
      lower_band: lowerBand,
      signal: signals,
    },
  }
}

writeFileSync(join(FIXTURES, 'history.json'), JSON.stringify(history, null, 2))
writeFileSync(join(FIXTURES, 'sma.json'), JSON.stringify(smaData, null, 2))

console.log(`Generated fixtures for ${SYMBOLS.length} symbols × ${DAYS} days`)
