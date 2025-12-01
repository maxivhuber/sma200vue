import type { LiveStrategyMessage } from './useLiveStrategyData'
import type { SMAResponse } from './useStrategieData'

export function mergeSmaData(
  base: SMAResponse | null,
  live: LiveStrategyMessage | null,
): SMAResponse | null {
  if (!base) return null
  if (!live) return base

  // deep clone so Vue doesn't mutate API data
  const merged = JSON.parse(JSON.stringify(base)) as SMAResponse

  const r = merged.result
  const liveR = live.result

  const lastIndex = r.dates.length - 1
  const lastDate = r.dates[lastIndex]
  const liveDate = liveR.date

  if (liveDate === lastDate) {
    r.prices[lastIndex] = liveR.prices
    r.sma[lastIndex] = liveR.sma
    r.upper_band[lastIndex] = liveR.upper_band
    r.lower_band[lastIndex] = liveR.lower_band
    r.signal[lastIndex] = liveR.signal
  } else {
    r.dates.push(liveR.date)
    r.prices.push(liveR.prices)
    r.sma.push(liveR.sma)
    r.upper_band.push(liveR.upper_band)
    r.lower_band.push(liveR.lower_band)
    r.signal.push(liveR.signal)
  }

  return merged
}
