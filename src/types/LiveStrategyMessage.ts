export interface LiveStrategyMessage {
  symbol: string
  strategy: string
  timestamp: string
  result: {
    date: string
    price: number
    sma: number
    upper_band: number
    lower_band: number
    signal: string
  }
}
