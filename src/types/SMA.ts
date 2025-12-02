export interface SMAResult {
  dates: string[]
  prices: number[]
  sma: number[]
  upper_band: number[]
  lower_band: number[]
  signal: string[]
}

export interface SMAResponse {
  symbol: string
  strategy: 'sma'
  timestamp: string
  result: SMAResult
}
