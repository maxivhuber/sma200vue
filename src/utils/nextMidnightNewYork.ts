import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

export function nextMidnightNewYork(): number {
  const nowNY = dayjs().tz('America/New_York')
  return nowNY.add(1, 'day').startOf('day').valueOf()
}
