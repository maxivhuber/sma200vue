import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'

import type { LabeledItem } from '../src/types/LabeledItem'
import type { StockDataPoint } from '../src/types/StockDataPoint'
import type { SMAResponse } from '../src/types/SMA'

const PORT = Number(process.env.MOCK_PORT) || 3001
const FIXTURES = join(import.meta.dirname, 'fixtures')

const symbols: LabeledItem[] = JSON.parse(readFileSync(join(FIXTURES, 'symbols.json'), 'utf-8'))
const strategies: LabeledItem[] = JSON.parse(
  readFileSync(join(FIXTURES, 'strategies.json'), 'utf-8'),
)
const historyBySymbol: Record<string, StockDataPoint[]> = JSON.parse(
  readFileSync(join(FIXTURES, 'history.json'), 'utf-8'),
)
const smaBySymbol: Record<string, SMAResponse> = JSON.parse(
  readFileSync(join(FIXTURES, 'sma.json'), 'utf-8'),
)

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const path = url.pathname
  const symbol = url.searchParams.get('symbol')

  if (path === '/api/symbols') return json(res, symbols)
  if (path === '/api/strategies') return json(res, strategies)

  if (path === '/api/history') {
    const data = symbol ? historyBySymbol[symbol] : undefined
    if (!data) return json(res, { error: 'unknown symbol' }, 404)
    return json(res, data)
  }

  const analyticsMatch = path.match(/^\/api\/analytics\/(\w+)$/)
  if (analyticsMatch) {
    const strategy = analyticsMatch[1]
    if (strategy === 'sma' && symbol) {
      const data = smaBySymbol[symbol]
      if (!data) return json(res, { error: 'unknown symbol' }, 404)
      return json(res, data)
    }
    return json(res, { error: 'unsupported strategy' }, 404)
  }

  json(res, { error: 'not found' }, 404)
}

const server = createServer(handleRequest)

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  if (/^\/ws\/analytics\/\w+$/.test(url.pathname)) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const symbol = url.searchParams.get('symbol')
  const strategyMatch = url.pathname.match(/^\/ws\/analytics\/(\w+)$/)
  const strategy = strategyMatch?.[1]

  if (!symbol || !strategy || strategy !== 'sma') {
    ws.close(1008, 'invalid params')
    return
  }

  const sma = smaBySymbol[symbol]
  if (!sma) {
    ws.close(1008, 'unknown symbol')
    return
  }

  const lastIdx = sma.result.dates.length - 1
  const basePrice = sma.result.prices[lastIdx]

  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return

    const jitter = (Math.random() - 0.5) * basePrice * 0.002
    const price = +(basePrice + jitter).toFixed(2)
    const smaVal = sma.result.sma[lastIdx]

    const msg = {
      symbol,
      strategy,
      timestamp: new Date().toISOString(),
      result: {
        date: sma.result.dates[lastIdx],
        price,
        sma: smaVal,
        upper_band: sma.result.upper_band[lastIdx],
        lower_band: sma.result.lower_band[lastIdx],
        signal: price > smaVal ? 'BUY' : 'SELL',
      },
    }
    ws.send(JSON.stringify(msg))
  }, 2000)

  ws.on('close', () => clearInterval(interval))
})

server.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${PORT}`)
})
