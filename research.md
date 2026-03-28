# ChartLab - Deep Codebase Analysis

## 1. What the Application Does

ChartLab is a single-page financial charting application. It lets a user:

1. Pick a stock symbol from a server-provided list.
2. View that symbol's historical closing prices on an interactive line chart.
3. Optionally overlay a **SMA (Simple Moving Average) strategy** on the chart, which adds the SMA line, upper/lower Bollinger Bands, and buy/sell signal markers.
4. Receive **real-time updates** over WebSocket so the chart's latest data point (or a new day's data) is merged in without a full refetch.
5. Toggle a **logarithmic Y-axis** for long-term trend analysis.
6. Zoom and pan freely on the time axis; zoom state is preserved across data refreshes and only resets when the symbol changes.

In production the backend API lives at `invest.mhuber.dev`. For local development a mock server replaces it entirely (see section 9).

---

## 2. Tech Stack

| Layer | Technology | Version constraint |
|---|---|---|
| Framework | Vue 3 (Composition API, `<script setup>`) | ^3.5.22 |
| Language | TypeScript | ~5.9.0 |
| Build tool | Vite 7 | ^7.1.11 |
| Charts | Apache ECharts 6 (used directly, no Vue wrapper) | ^6.0.0 |
| Client-side DB | Dexie (IndexedDB wrapper) | ^4.2.1 |
| Date handling | Day.js (with utc + timezone plugins) | ^1.11.19 |
| Linting | ESLint 9 + eslint-plugin-vue + @vue/eslint-config-typescript | flat config |
| Formatting | Prettier 3.6 | integrated via eslint-config-prettier (skip-formatting mode) |
| Bundle analysis | rollup-plugin-visualizer (opens `stats.html` on build) | ^6.0.5 |
| Dev tooling | vite-plugin-vue-devtools | ^8.0.3 |
| Mock server runtime | tsx (TypeScript executor) | ^4.21.0 |
| Mock WebSocket | ws | ^8.20.0 |
| Production serving | nginx (via Docker multi-stage build) | stable-alpine |
| Node requirement | ^20.19.0 or >=22.12.0 | enforced in `engines` |

There is **no Vue Router** and **no Pinia/Vuex** -- the app is a single view with local refs.

---

## 3. Project Structure (every source file)

```
src/
  main.ts                          App bootstrap
  App.vue                          Root component, all top-level state
  db.ts                            Dexie database setup

  api/
    config.ts                      Environment-aware base URLs (REST + WebSocket)
    client.ts                      Generic apiFetch<T>() wrapper
    requests.ts                    getSymbols(), getStrategies()

  composables/
    useSymbols.ts                  Fetches symbol list on mount
    useStrategies.ts               Fetches strategy list on mount
    useStockData.ts                Fetches + caches historical price data
    useStrategieData.ts            Fetches + caches SMA strategy data
    useLiveStrategyData.ts         WebSocket connection for live updates
    useSmaMerge.ts                 Merges cached SMA data with live WS message

  components/
    SymbolSelector.vue             Clickable list of symbols (v-model)
    StrategieSelector.vue          Clickable list of strategies (toggle, v-model)
    BaseStockChart.vue             ECharts line chart for raw price data
    SmaStockChart.vue              ECharts chart with SMA + bands + signals
    LoadingSpinner.vue             Pure CSS spinner

  types/
    LabeledItem.ts                 { value: string, label: string }
    StockDataPoint.ts              OHLCV row (Date, Open, High, Low, Close, Adj Close, Volume)
    SMA.ts                         SMAResult + SMAResponse interfaces
    LiveStrategyMessage.ts         Shape of a single WS message
    DataZoomEvent.ts               Minimal ECharts datazoom event type
    Cache.ts                       CachedSeries (union of stock + SMA data)

  assets/
    main.css                       Global styles, CSS custom properties

mock/
  server.ts                        HTTP + WebSocket mock server
  generate-fixtures.ts             One-time script to produce fixture JSON files
  fixtures/
    symbols.json                   LabeledItem[] — 3 mock stock tickers
    strategies.json                LabeledItem[] — single "SMA 200" strategy
    history.json                   Record<symbol, StockDataPoint[]> — 500 trading days per symbol
    sma.json                       Record<symbol, SMAResponse> — matching SMA analytics data
```

Supporting config at root: `vite.config.ts`, `eslint.config.ts`, `tsconfig.json` (project references to `tsconfig.app.json` + `tsconfig.node.json`), `Dockerfile`, `env.d.ts`.

---

## 4. Architecture Deep-Dive

### 4.1 State Management

All application state is held in `App.vue` as plain `ref`s:

- `selectedSymbol: Ref<LabeledItem | null>` -- the currently selected stock.
- `selectedStrategy: Ref<LabeledItem | null>` -- the currently selected strategy (can be toggled off).
- `logScale: Ref<boolean>` -- Y-axis mode.

Computed properties derive the `.value` and `.label` strings from these. The composables accept the derived `Ref<string | null>` values and use `watch()` to react to changes.

There is no global store. Data flows strictly downward: `App.vue` -> composable refs -> component props.

### 4.2 Data Fetching and Environment-Aware URL Resolution

**URL configuration** (`config.ts`):

The API and WebSocket base URLs are environment-aware. In development (`import.meta.env.DEV === true`), both use relative paths (`/api/`, `ws://{host}/ws/`) so that Vite's dev server proxy can intercept them. In production, they point to the hardcoded `https://invest.mhuber.dev` origin.

```ts
const isDev = import.meta.env.DEV

export const API_CONFIG = {
  baseURL: isDev ? '/api/' : 'https://invest.mhuber.dev/api/',
}
```

**URL construction** (`client.ts`):

The `apiFetch<T>()` wrapper resolves paths using a two-stage `new URL()` call:

```ts
const url = new URL(cleanPath, new URL(API_CONFIG.baseURL, location.origin)).toString()
```

The inner `new URL(API_CONFIG.baseURL, location.origin)` converts the potentially-relative `/api/` into an absolute URL using the browser's current origin. This is necessary because the `URL` constructor requires an absolute base. When `baseURL` is already absolute (production), `location.origin` is ignored.

**REST API endpoints**:

- `GET /api/symbols` -- returns `LabeledItem[]` (list of available stock tickers).
- `GET /api/strategies` -- returns `LabeledItem[]` (list of available strategies).
- `GET /api/history?symbol=X` -- returns `StockDataPoint[]` (OHLCV time series).
- `GET /api/analytics/{strategy}?symbol=X` -- returns `SMAResponse` (dates, prices, sma, upper_band, lower_band, signal arrays).

**WebSocket** (`useLiveStrategyData`):

- Connects to `{wsBaseURL}analytics/{strategy}?symbol=X`.
- Receives `LiveStrategyMessage` objects (single data point with date, price, sma, bands, signal).
- Reconnection is not implemented -- a closed socket stays closed until the user changes symbol/strategy.
- The connection is torn down and `liveData` is reset to `null` whenever either `symbol` or `strategy` changes, preventing stale data from one symbol leaking into another.

### 4.3 Vite Dev Server Proxy

`vite.config.ts` defines two proxy rules active during development:

```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:3001', changeOrigin: true },
    '/ws':  { target: 'ws://localhost:3001', ws: true },
  },
},
```

All requests from the browser to `/api/*` are forwarded as HTTP to the mock server on port 3001. All WebSocket upgrade requests to `/ws/*` are forwarded as WebSocket connections. This is transparent to the application code -- the frontend just fetches from its own origin.

### 4.4 Caching Layer

`db.ts` creates a Dexie database `StockDatabase` with one object store `stockdata`, indexed on `id` and `expireAt`.

Both `useStockData` and `useStrategieData` follow the same pattern:

1. Before fetching, check IndexedDB for a cached entry.
2. If the entry exists and `Date.now() < entry.expireAt`, use it.
3. Otherwise, fetch from the API and store with an expiry of **next midnight in America/New_York** (i.e., data is valid until the next NYSE trading day starts).

Cache keys:
- Stock data: the symbol string (e.g., `"AAPL"`).
- Strategy data: `"symbol:strategy"` (e.g., `"AAPL:sma"`).

Both data shapes (`StockDataPoint[]` and `SMAResponse`) are stored in the same table, discriminated at read time by checking the shape of `cached.data`.

### 4.5 Live Data Merging

`useSmaMerge.ts` is a pure function (`mergeSmaData`) that takes the cached `SMAResponse` and the latest `LiveStrategyMessage` and returns a new `SMAResponse`:

- If the live message's date matches the last date in the cached result, **it overwrites the last data point** (intraday update).
- If the date is different, **it appends a new entry** to every array (new trading day).
- A `JSON.parse(JSON.stringify())` deep clone is used to avoid mutating the cached data, which would break Vue's reactivity.

This merge only runs when the selected strategy is `'sma'` (controlled in `App.vue`'s computed).

### 4.6 Chart Rendering

Both chart components (`BaseStockChart` and `SmaStockChart`) follow an identical pattern:

1. **Initialization**: `echarts.init()` in `onMounted` after a `nextTick()`.
2. **Data zoom persistence**: Two refs (`zoomStartValue`, `zoomEndValue`) track the user's current zoom. They are set from the `datazoom` ECharts event. On re-render, the zoom values are passed back to the `dataZoom` option, preserving position.
3. **YTD default zoom**: When zoom refs are null (initial load or symbol change), the chart calculates the index of January 1st of the current year and zooms to [YTD start, last data point].
4. **Zoom reset on symbol change**: A watcher on `props.symbol` nullifies the zoom refs, so the next render falls back to YTD.
5. **Log scale**: The `yAxis` config switches between `type: 'value'` and `type: 'log'` (base 10) based on the `logScale` prop.
6. **Cleanup**: `chart.dispose()` in `onBeforeUnmount`. A window resize listener calls `chart.resize()`.

**BaseStockChart** renders a single "Close" line with an area fill.

**SmaStockChart** renders six series:
- Price line (with area fill)
- SMA line
- Upper Bollinger Band (green dashed)
- Lower Bollinger Band (red dashed)
- Buy signals (green scatter dots, filtered from the `signal` array)
- Sell signals (red scatter dots)

Both charts use the `--primary-color` CSS custom property (`#0077cc`) for the price line.

### 4.7 Selector Components

**SymbolSelector**: A list of `LabeledItem`s. Clicking one sets `v-model` to that item. Selection is mandatory once made (no deselect).

**StrategieSelector**: Same visual pattern but with **toggle behavior** -- clicking an already-selected strategy deselects it (sets `v-model` to `null`). Also supports a `disabled` prop that blocks interaction (used when no symbol is selected).

Both use the standard `update:modelValue` emit pattern for `v-model` binding.

### 4.8 Conditional Chart Rendering in App.vue

The template in `App.vue` has a priority chain for what to show in the chart area:

1. No symbol selected -> "Please select a symbol" message.
2. Data still loading -> `LoadingSpinner`.
3. Fetch error -> error message.
4. Symbol selected but no strategy -> `BaseStockChart` (plain price chart).
5. Strategy is `'sma'` and merged data exists -> `SmaStockChart`.
6. Any other strategy -> "not supported yet" placeholder.

This means only the `sma` strategy is currently implemented on the frontend. The backend may offer others, but they'll show the fallback message.

---

## 5. API Contract Details

### REST Endpoints

| Endpoint | Method | Response type |
|---|---|---|
| `/api/symbols` | GET | `LabeledItem[]` |
| `/api/strategies` | GET | `LabeledItem[]` |
| `/api/history?symbol={symbol}` | GET | `StockDataPoint[]` |
| `/api/analytics/{strategy}?symbol={symbol}` | GET | `SMAResponse` |

### WebSocket

| URL | Direction | Message type |
|---|---|---|
| `/ws/analytics/{strategy}?symbol={symbol}` | Server -> Client | `LiveStrategyMessage` (JSON) |

### Key Data Shapes

**StockDataPoint** (OHLCV):
```ts
{ Date: string, Open: number, High: number, Low: number, Close: number, "Adj Close": number, Volume: number }
```

**SMAResponse**:
```ts
{
  symbol: string,
  strategy: "sma",
  timestamp: string,
  result: {
    dates: string[], prices: number[], sma: number[],
    upper_band: number[], lower_band: number[], signal: string[]
  }
}
```

**LiveStrategyMessage**:
```ts
{
  symbol: string, strategy: string, timestamp: string,
  result: { date: string, price: number, sma: number, upper_band: number, lower_band: number, signal: string }
}
```

Note the structural difference: `SMAResponse.result` uses parallel arrays (columnar), while `LiveStrategyMessage.result` is a single row. The merge function bridges these two shapes.

---

## 6. Styling

All global styles live in `src/assets/main.css`. The layout is:

- A full-viewport flexbox column (`.app`) with a sticky header panel.
- A CSS Grid content area: `280px` left sidebar + `1fr` chart area.
- Overflow is hidden on both `html`/`body` and `.content`, so the chart fills its available space without page scrolling.
- CSS custom properties define the color palette (`--primary-color: #0077cc`, etc.).
- Chart components use scoped styles with `width: 100%; height: 100%` to fill their grid cell.
- Hover and active micro-interactions on selectors (color change, subtle scale).

There is no responsive/mobile breakpoint -- the fixed 280px sidebar grid assumes a desktop viewport.

---

## 7. Build and Deployment

### Development
```bash
npm run dev          # Vite dev server with HMR (requires real backend or mock)
npm run dev:mock     # Vite dev server + mock server in parallel (fully self-contained)
```

### Production Build
```bash
npm run build        # vue-tsc type check + vite build (parallel via npm-run-all2)
npm run build-only   # vite build only, skip type check
```

The build produces `dist/` which is a static SPA. `rollup-plugin-visualizer` generates `stats.html` (bundle analysis) and opens it in the browser on every build.

### Docker Deployment
```bash
docker build -t sma200vue:latest .
docker run -d --name sma200vue --network services-net --restart unless-stopped sma200vue:latest
```

Multi-stage Dockerfile: `node:lts-alpine` for build, `nginx:stable-alpine` for serving. The built `dist/` is copied to nginx's default HTML root. The container exposes port 80 and joins a Docker network called `services-net`, suggesting the backend API runs in a sibling container on the same network.

### Code Quality
```bash
npm run lint         # eslint with --fix --cache
npm run format       # prettier on src/
npm run type-check   # vue-tsc --build
```

ESLint uses the flat config format (`eslint.config.ts`) with Vue essential rules + TypeScript recommended rules. Prettier formatting is delegated entirely to the `format` script (ESLint skips formatting rules via `skip-formatting`).

---

## 8. Mock Server

The `mock/` directory contains a self-contained development backend that replaces the real `invest.mhuber.dev` API. It exists so that frontend development and testing can happen without network access or a running backend.

### 8.1 Architecture

The mock server is a single Node.js process (`mock/server.ts`) that serves both HTTP and WebSocket on port 3001 (configurable via `MOCK_PORT` env var). It is executed with `tsx` (a lightweight TypeScript runner) and has zero runtime dependencies beyond Node built-ins and the `ws` package.

The server imports type definitions directly from `src/types/` to ensure fixture data matches the application's expected shapes (`LabeledItem`, `StockDataPoint`, `SMAResponse`).

### 8.2 How It Integrates

The integration is achieved through three coordinated pieces:

1. **Vite proxy** (`vite.config.ts`): Routes `/api/*` and `/ws/*` from the browser to `localhost:3001`.
2. **Environment-aware config** (`src/api/config.ts`): Uses relative paths in dev mode so requests hit the Vite origin (which proxies them), and absolute URLs in production.
3. **Origin-aware URL construction** (`src/api/client.ts`): The `apiFetch` wrapper resolves relative base URLs against `location.origin` to produce valid absolute URLs for the `fetch()` call.

No application code beyond `config.ts` and `client.ts` is aware of the mock server's existence. Components, composables, and the rest of the API layer are unchanged.

### 8.3 REST Route Handling

The server loads all four fixture JSON files into memory at startup and serves them through a simple `handleRequest` function with pattern-matched routing:

| Route | Fixture source | Behavior |
|---|---|---|
| `GET /api/symbols` | `symbols.json` | Returns the full array |
| `GET /api/strategies` | `strategies.json` | Returns the full array |
| `GET /api/history?symbol=X` | `history.json[X]` | Looks up by symbol key, 404 if missing |
| `GET /api/analytics/sma?symbol=X` | `sma.json[X]` | Looks up by symbol key, 404 if missing |

Unknown routes return `{ "error": "not found" }` with status 404.

### 8.4 WebSocket Simulation

The WebSocket server uses `noServer` mode -- it listens for HTTP upgrade events and manually promotes connections matching `/ws/analytics/{strategy}`. Non-matching upgrade requests have their sockets destroyed.

Once connected, the server sends a `LiveStrategyMessage` every 2 seconds. The message simulates intraday price movement by:

1. Taking the last price in the SMA fixture as a base.
2. Applying a random jitter of +/- 0.1% per tick.
3. Deriving the signal as `'BUY'` if the jittered price is above the SMA value, `'SELL'` otherwise.
4. Using the last date in the fixture (not the current date), which means the merge function in `useSmaMerge.ts` will always take the "same date" overwrite path rather than the "new day" append path.

The interval is cleared when the client disconnects.

### 8.5 Fixture Generation

`mock/generate-fixtures.ts` is a one-time script (run via `npm run mock:generate`) that produces all four fixture files. It generates data for 3 symbols (AAPL starting at $130, MSFT at $250, GOOGL at $90) over 500 trading days starting from 2023-01-03.

**Trading day calculation**: Iterates from the start date, skipping Saturdays and Sundays (but not market holidays -- a simplification).

**Price generation**: A random walk with slight upward drift. Each step is `(Math.random() - 0.48) * startPrice * 0.02`, meaning the expected daily change is slightly positive (0.02 * startPrice * 0.02 = 0.04% per day).

**SMA calculation**: A true rolling average over a 200-day window (or fewer for the first 199 points, which use all available data).

**Bollinger Bands**: Simplified as SMA +/- 5% (rather than using actual standard deviation). This produces wider bands than real Bollinger Bands but is sufficient for visual testing.

**Signal generation**: `'BUY'` when price <= lower band, `'SELL'` when price >= upper band, `'HOLD'` otherwise.

**OHLCV data**: Open/High/Low are derived from Close with small random offsets (+/- 0.5% for Open, 0-1.5% for High/Low). Volume is uniformly random between 50M and 150M.

### 8.6 npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run mock` | `tsx mock/server.ts` | Start mock server standalone on port 3001 |
| `npm run mock:generate` | `tsx mock/generate-fixtures.ts` | Regenerate fixture JSON files |
| `npm run dev:mock` | `run-p mock dev` | Start mock server + Vite dev server in parallel |

`dev:mock` uses `npm-run-all2`'s `run-p` to run both processes concurrently. Killing the script (Ctrl+C) stops both.

---

## 9. Notable Design Decisions and Specificities

1. **No state management library**: For an app this size, raw refs + composables are sufficient. The data flow is strictly unidirectional.

2. **Parallel arrays (columnar) for SMA data**: The API returns `dates[]`, `prices[]`, `sma[]`, etc. as separate arrays rather than an array of objects. This is unusual but efficient for charting since ECharts consumes series data as flat arrays.

3. **NYSE-midnight cache expiry**: Cache invalidation is tied to NYSE trading hours (America/New_York midnight), not a fixed TTL. This means cached data stays valid throughout the trading day and is refreshed overnight.

4. **Deep clone for merge safety**: `JSON.parse(JSON.stringify())` is used in the merge function to prevent mutations of the cached/reactive data. This is a deliberate trade-off (performance cost of serialization vs. correctness of Vue reactivity).

5. **No WebSocket reconnection**: If the WebSocket closes unexpectedly, it is not reopened. The only reconnection path is the user changing symbol/strategy (which tears down and rebuilds the connection).

6. **"Strategie" naming**: Several composables and components use "Strategie" (without the "y") -- `useStrategieData`, `StrategieSelector`, `strategieData`, `strategieLoading`, `strategieError`. This naming is carried consistently throughout the codebase.

7. **Only SMA strategy implemented**: The frontend architecture supports multiple strategies (the selector shows all strategies from the API), but only `'sma'` has a corresponding chart component and data flow. Any other strategy value falls through to a "not supported yet" message. The mock server mirrors this -- it only serves SMA data.

8. **ECharts used without a Vue wrapper**: Rather than using `vue-echarts`, the chart components manage the ECharts lifecycle directly with `init`/`dispose`/`resize`. This gives full control over option updates and event handling at the cost of more manual lifecycle management.

9. **Zoom state persistence pattern**: Both chart components maintain zoom state in component-level refs that survive data updates (via `watch`) but reset when the symbol changes. This means toggling log scale or receiving a live update doesn't lose the user's current zoom position.

10. **Bundle analysis always runs**: The `visualizer()` plugin is in the production build config (not behind a flag), so every `npm run build` generates and opens `stats.html`.

11. **`@types/luxon` dependency**: Listed in dependencies but Luxon is not used anywhere in the code. Day.js is used instead. This is likely a leftover from a migration.

12. **No test infrastructure**: There are no test files, no test runner configured, and no test script in `package.json`. The `tsconfig.app.json` excludes `__tests__` directories (from the Vue project template), but no tests exist.

13. **Environment-gated URL switching**: `src/api/config.ts` uses `import.meta.env.DEV` to switch between relative paths (dev, proxied to mock) and absolute URLs (production, pointing to `invest.mhuber.dev`). This is the only application source file that is environment-aware. The production build is unaffected -- Vite statically replaces `import.meta.env.DEV` with `false` and the bundler tree-shakes the dev paths.

14. **Two-stage URL resolution in apiFetch**: The `new URL(cleanPath, new URL(API_CONFIG.baseURL, location.origin))` pattern handles both relative (`/api/`) and absolute (`https://...`) base URLs. The inner `new URL` always produces an absolute URL (using `location.origin` as fallback), which satisfies the outer `new URL`'s requirement for an absolute base. When the base is already absolute, `location.origin` is ignored by the `URL` constructor.

15. **Mock server shares app types**: `mock/server.ts` imports from `../src/types/` directly, so fixture data is type-checked against the same interfaces the frontend uses. If a type changes in the app, the mock server will fail to compile until its fixtures are updated -- this acts as a contract test.

16. **Mock WebSocket always overwrites, never appends**: The mock server sends ticks with the last date in the fixture data, not the current calendar date. This means the merge function in `useSmaMerge.ts` always takes the "same date, update in place" branch. To test the "new day, append" branch, the fixture's last date would need to differ from the date sent in the WebSocket message.

17. **Fixture data is deterministic per run but not seeded**: The generator uses `Math.random()` without a seed, so each run of `npm run mock:generate` produces different price histories. The generated files are committed as static JSON, so the mock data is stable across dev sessions until explicitly regenerated.
