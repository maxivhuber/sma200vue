# Bug Investigation — Comprehensive Audit

## Summary

Systematic audit of correctness, stability, and data integrity across the entire ChartLab codebase. Each bug includes file + line reference, root cause analysis, why it produces the symptom, and a minimal code snippet.

Severity scale: **Critical** (data corruption / leak across symbols), **High** (race condition / memory leak under normal use), **Medium** (edge-case crash or incorrect behavior), **Low** (cosmetic or unlikely).

---

## Bug 1 — Live WebSocket data leaks across symbols (Critical)

**File:** `src/composables/useLiveStrategyData.ts:15-19`

**What:** When the WebSocket `onmessage` fires, it writes into `liveData.value` unconditionally. There is no check that the incoming message's `symbol` field matches the *currently selected* symbol. If a message arrives from a previous connection during the brief window between when a new symbol is selected and when the old socket finishes closing, that message is written into `liveData` and consumed by the new symbol's chart.

**Why it causes the symptom:** WebSocket `.close()` is asynchronous — the socket may still receive buffered frames after `close()` is called but before the `onclose` event fires. During this window, the `onmessage` handler from the old connection is still active and writes into the same `liveData` ref that the new symbol's chart is reading.

**Sequence:**
1. User selects symbol A → WS connects, `onmessage` writes to `liveData`
2. User switches to symbol B → watcher fires, calls `disconnect()` then `connect()`
3. `disconnect()` calls `ws.close()` — but the old socket is now in `CLOSING` state, not `CLOSED`
4. A buffered frame from symbol A's server arrives → `onmessage` fires → `liveData.value` is set to symbol A's data
5. Symbol B's chart reads `liveData.value` and merges symbol A's price into symbol B's chart

```ts
// useLiveStrategyData.ts — the vulnerable handler
ws.onmessage = (e) => {
  try {
    liveData.value = JSON.parse(e.data) as LiveStrategyMessage  // no symbol guard
  } catch {}
}
```

**Additional concern:** The watcher at line 33-44 sets `liveData.value = null` *before* calling `disconnect()`, but `onmessage` can re-set it after the null assignment:

```ts
watch(
  [symbol, strategy],
  () => {
    liveData.value = null   // (A) reset
    disconnect()            // (B) ws.close() — async, old onmessage still active
    // Between (A) and the old socket actually closing, a message can arrive
    // and set liveData.value back to a non-null value from the OLD symbol
    if (symbol.value && strategy.value) {
      connect()             // (C) new connection — but liveData may already be polluted
    }
  },
  { flush: 'post' },
)
```

---

## Bug 2 — Race condition: stale fetch writes over fresh data (High)

**File:** `src/composables/useStockData.ts:37-58`

**What:** The `fetchData` function is `async` but there is no cancellation mechanism. If the user rapidly switches symbols (A → B), both fetches run concurrently. If symbol B's response arrives first and symbol A's response arrives second, `data.value` ends up holding symbol A's data while the UI shows symbol B as selected.

**Why:** The `watch` at line 60-67 calls `fetchData(s)` on every symbol change, but doesn't cancel or invalidate the previous in-flight request. The last response to arrive wins, regardless of whether it matches the current symbol.

```ts
// useStockData.ts
watch(
  selectedSymbol,
  (s) => {
    if (s) fetchData(s)    // no cancellation of previous fetch
    else data.value = null
  },
  { immediate: true },
)

async function fetchData(symbol: string) {
  // ... cache check ...
  loading.value = true
  try {
    const result = await apiFetch<StockDataPoint[]>(...)
    data.value = result    // if this is the SLOW response from the OLD symbol,
                           // it overwrites the fast response from the NEW symbol
  } catch (err) {
    error.value = err
  } finally {
    loading.value = false
  }
}
```

**Scenario:**
1. User selects AAPL → `fetchData("AAPL")` starts, network is slow
2. User switches to MSFT → `fetchData("MSFT")` starts, network is fast
3. MSFT response arrives → `data.value = MSFT data` ✓
4. AAPL response arrives late → `data.value = AAPL data` ✗ (stale overwrite)

---

## Bug 3 — Same race condition in useStrategieData (High)

**File:** `src/composables/useStrategieData.ts:42-65, 67-83`

**What:** Identical pattern to Bug 2. The `fetchData` function has no guard against stale responses.

```ts
// useStrategieData.ts
watch(
  [symbol, strategy],
  async ([s, st]) => {
    if (!s || !st) { data.value = null; return }
    if (st !== 'sma') { data.value = null; return }
    fetchData(s, st)   // no cancellation
  },
  { immediate: true },
)
```

The `loading.value = false` from a stale request also incorrectly clears the loading state while the current request may still be in flight.

---

## Bug 4 — Window resize listener never removed (Medium)

**File:** `src/components/BaseStockChart.vue:169`, `src/components/SmaStockChart.vue:227`

**What:** Both chart components add a `resize` event listener to `window` in `onMounted` but never remove it in `onBeforeUnmount`. The `chart.dispose()` call destroys the ECharts instance, but the anonymous arrow function remains registered on `window`, firing on every subsequent resize and calling `.resize()` on a disposed (null-ish) chart.

```ts
// BaseStockChart.vue:169
onMounted(async () => {
  // ...
  window.addEventListener('resize', () => chart?.resize())  // added
})

onBeforeUnmount(() => chart?.dispose())  // listener NOT removed
```

**Why it's a problem:**
- Memory leak: the closure retains a reference to the `chart` variable (and transitively the ECharts instance's data) even after disposal.
- After component unmount, the listener still fires. The `chart?.resize()` call is guarded by optional chaining so it won't throw (chart is set to null via disposal), but the listener itself and its closure are never collected.
- In a scenario where the chart component is conditionally rendered (which it is — the v-if chain in App.vue mounts/unmounts charts), each mount cycle adds another listener that is never cleaned up.

---

## Bug 5 — `loading` flag incorrectly false when serving from cache (Medium)

**File:** `src/composables/useStockData.ts:23-29, 37-58`

**What:** When data is found in the IndexedDB cache, `loading` is never set to `true`. This means the UI never shows a loading spinner for cached results, which is fine. However, the real issue is the *interaction with Bug 2*: if a cached response is returned synchronously (via microtask) while a network fetch is still in-flight from a previous symbol, `loading.value` remains `true` from the previous fetch (set at line 45) and is only cleared when the stale response finally arrives.

```ts
async function fetchData(symbol: string) {
  const cached = await load(symbol)
  if (cached) {
    data.value = cached
    return              // loading was never set to true, but it may ALREADY be true
                        // from a previous in-flight fetch — and it stays true forever
                        // until that old fetch resolves
  }
  loading.value = true
  // ...
}
```

**Scenario:**
1. Fetch AAPL from network → `loading = true`
2. While AAPL is loading, switch to MSFT → `fetchData("MSFT")` runs
3. MSFT is in cache → `data.value = cached`, return
4. `loading` is still `true` from step 1 → spinner stays visible even though data is rendered
5. Eventually AAPL fetch completes → `loading = false`, but `data.value` is overwritten with AAPL data (Bug 2)

---

## Bug 6 — `strategieData` not cleared when symbol changes without strategy change (Medium)

**File:** `src/composables/useStrategieData.ts:67-83`

**What:** The watcher watches `[symbol, strategy]`. When only the symbol changes (strategy stays `'sma'`), a new fetch begins. But `data.value` is not reset to `null` before the fetch — it retains the *previous symbol's* SMA data until the new response arrives. During this window, the chart displays the old symbol's SMA overlaid on the new symbol's price data.

```ts
watch(
  [symbol, strategy],
  async ([s, st]) => {
    if (!s || !st) { data.value = null; return }
    if (st !== 'sma') { data.value = null; return }
    fetchData(s, st)  // data.value still holds PREVIOUS symbol's SMAResponse
  },
  { immediate: true },
)
```

Compare with `useStockData.ts:63` which *does* clear data when the symbol is null but also doesn't clear it before a new fetch when switching from one valid symbol to another.

**Visible effect:** User sees AAPL's SMA lines drawn on MSFT's price chart for the duration of the network fetch.

---

## Bug 7 — WebSocket `connect()` uses stale closure over `symbol`/`strategy` (Medium)

**File:** `src/composables/useLiveStrategyData.ts:9-24`

**What:** The `connect` function reads `symbol.value` and `strategy.value` at call time (line 10-11), which is correct. However, the `onmessage` handler at line 15 captures `liveData` by closure, which is fine since `liveData` is a ref. The real issue is subtle: `connect()` is called inside the watcher (line 40), which fires with `{ flush: 'post' }`. This means it runs after the DOM update cycle. Between the watcher trigger and the `post` flush, another reactive change could theoretically update `symbol.value` — but since `connect()` reads `.value` at call time (post-flush), it reads the correct value. **This is NOT a bug in the current code** but is noted as a fragility: if `connect` were ever made async or deferred, the closure would break.

**Actual bug within `connect`:** There is no guard against `connect()` being called while a previous socket is still in the `CONNECTING` state. If the watcher fires twice in rapid succession before the first socket opens, two sockets can be created but only the second is tracked in the `ws` variable — the first becomes an orphaned connection that is never closed:

```ts
const connect = () => {
  if (!symbol.value || !strategy.value) return
  // No check: if (ws) return or if (ws) disconnect()
  const url = `${WS_CONFIG.baseURL}analytics/${strategy.value}?symbol=${symbol.value}`
  ws = new WebSocket(url)  // if called twice, first socket is leaked
  // ...
}
```

The watcher does call `disconnect()` before `connect()`, but `disconnect()` only closes the socket tracked in `ws`. If a timing edge causes `connect()` to be called again before the previous `disconnect()` + `connect()` sequence completes, the intermediate socket leaks.

---

## Bug 8 — ECharts `setOption` is called with full replacement semantics (Low)

**File:** `src/components/SmaStockChart.vue:57-202`, `src/components/BaseStockChart.vue:49-143`

**What:** Both `renderChart`/`renderBaseChart` call `chart.setOption({...})` with a complete option object but without passing `{ notMerge: true }` as the second argument. ECharts defaults to merge mode, meaning old series, axis data, or other options from a previous `setOption` call can bleed through if the new option doesn't explicitly override them.

**When it matters:** If the chart is first rendered with data that has 500 points and then re-rendered with data that has 400 points, the merged option may retain stale series entries from the previous render. In practice this is mitigated by the fact that the option object is complete — but ECharts merge semantics for arrays (like `series`) are append-based, not replacement.

```ts
// SmaStockChart.vue
chart.setOption({
  // full option
})
// Should be:
// chart.setOption({ ... }, { notMerge: true })
```

---

## Bug 9 — StrategieSelector internal `selected` ref can desync from `modelValue` prop (Low)

**File:** `src/components/StrategieSelector.vue:15, 17-19`

**What:** The component initializes `selected` from `props.modelValue` at setup time (line 15) and watches `props.modelValue` for external changes (line 17-19). However, the watcher is not `{ immediate: true }`, so if the parent sets `modelValue` before the watcher is first triggered, the internal ref may be out of sync for one tick.

```ts
const selected = ref<LabeledItem | null>(props.modelValue ?? null)

watch(
  () => props.modelValue,
  (v) => (selected.value = v ?? null),
  // missing { immediate: true } — though initial value is set above,
  // there's a subtle race if modelValue changes between setup and first watch tick
)
```

Same pattern exists in `SymbolSelector.vue:15, 17-19`.

In practice this is unlikely to cause visible issues since the parent starts with `null` and the component initializes to `null`.

---

## Bug 10 — `useStrategieData` ignores non-SMA strategies silently (Low)

**File:** `src/composables/useStrategieData.ts:75-77`

**What:** The watcher has an early return for `st !== 'sma'` that sets `data.value = null` but does not set `loading.value = false` or `error.value = null`. If a previous SMA fetch had set `loading = true` or `error` to something, those states persist incorrectly.

```ts
if (st !== 'sma') {
  data.value = null
  return           // loading and error not cleared
}
```

---

## Bug 11 — Cache discrimination is brittle (Low)

**File:** `src/composables/useStrategieData.ts:23-30`, `src/composables/useStockData.ts:24-29`

**What:** Both composables store different data types in the same Dexie table and discriminate at read time by duck-typing:

```ts
// useStrategieData.ts
if (cached.data && typeof cached.data === 'object' && 'strategy' in cached.data) {
  return cached.data as SMAResponse
}

// useStockData.ts
if (Array.isArray(cached.data)) {
  return cached.data as StockDataPoint[]
}
```

If the cache keys ever collide (e.g., a symbol string like `"sma"` matched as both a stock key and part of a strategy key), one composable would read the other's data and the type assertion would produce a runtime shape mismatch.

Currently the keys don't collide (`"AAPL"` vs `"AAPL:sma"`), but the discrimination relies on an implicit structural contract rather than an explicit type tag.

---

## Bug 12 — `nextMidnightNewYork` is duplicated and can produce wrong expiry around DST (Low)

**File:** `src/composables/useStockData.ts:12-16`, `src/composables/useStrategieData.ts:13-17`

**What:** The function is copy-pasted in two files. More importantly, on DST transition days the "next midnight" calculation may be off by an hour, causing cache entries to expire an hour early or an hour late. Day.js's `.startOf('day')` in a timezone-aware context handles this correctly, but the `.add(1, 'day').startOf('day')` pattern can skip or double-count the DST transition day depending on which side of midnight the code runs.

```ts
function nextMidnightNewYork(): number {
  const nowNY = dayjs().tz('America/New_York')
  const nextMidnight = nowNY.add(1, 'day').startOf('day')
  return nextMidnight.valueOf()
}
```

If run at 11:30 PM ET on the day clocks spring forward, `add(1, 'day')` adds 24 hours (putting the result at 12:30 AM ET the day after next since the day only had 23 hours), then `startOf('day')` rounds back to midnight of that day — which is 25 hours away instead of 0.5 hours. The cache entry lives an extra day.

---

## Bugs by Severity

| # | Severity | Summary |
|---|---|---|
| 1 | Critical | WebSocket messages from previous symbol leak into current symbol's live data |
| 2 | High | Race condition: stale stock fetch overwrites fresh data on rapid symbol switch |
| 3 | High | Race condition: same pattern in strategy data fetch |
| 4 | Medium | Window resize listeners accumulate, never removed on unmount |
| 5 | Medium | Loading flag stuck `true` when switching from network to cached symbol |
| 6 | Medium | Old symbol's SMA data visible on new symbol's chart during fetch |
| 7 | Medium | Orphaned WebSocket if connect() called twice before first socket opens |
| 8 | Low | ECharts merge mode may retain stale series data across re-renders |
| 9 | Low | Selector internal ref can desync from modelValue for one tick |
| 10 | Low | Loading/error state not cleared when switching to non-SMA strategy |
| 11 | Low | Cache type discrimination relies on duck-typing, no explicit type tag |
| 12 | Low | Duplicated `nextMidnightNewYork` with potential DST edge case |

---

## Implementation Plan

Fixes are grouped into phases by dependency order. Each phase can be validated independently before moving to the next. Within a phase, tasks are ordered so that earlier tasks don't conflict with later ones in the same files.

---

### Phase 1 — Critical: WebSocket data leak (Bugs 1, 7)

Both bugs are in the same file and the fix for Bug 7 is a prerequisite for a clean Bug 1 fix.

- [x] **1.1** `src/composables/useLiveStrategyData.ts` — Nullify the `onmessage` handler on the old socket before closing it. In `disconnect()`, set `ws.onmessage = null` before calling `ws.close()`. This kills the leak path immediately regardless of buffered frames.

```ts
const disconnect = () => {
  if (ws) {
    ws.onmessage = null
    ws.close()
    ws = null
  }
}
```

- [x] **1.2** `src/composables/useLiveStrategyData.ts` — Add a symbol guard inside `onmessage`. Even after fix 1.1, a defense-in-depth check ensures a message is only accepted if its `symbol` matches the current selection:

```ts
ws.onmessage = (e) => {
  try {
    const parsed = JSON.parse(e.data) as LiveStrategyMessage
    if (parsed.symbol !== symbol.value) return
    liveData.value = parsed
  } catch {}
}
```

- [x] **1.3** `src/composables/useLiveStrategyData.ts` — Guard `connect()` against orphaned sockets (Bug 7). Call `disconnect()` at the top of `connect()` so any existing socket (including one in `CONNECTING` state) is torn down before a new one is created:

```ts
const connect = () => {
  if (!symbol.value || !strategy.value) return
  disconnect()
  const url = ...
  ws = new WebSocket(url)
  // ...
}
```

- [x] **1.4** Verify: run `npm run dev:mock`, rapidly switch symbols with SMA strategy selected, confirm no cross-symbol data appears in the chart or console.

---

### Phase 2 — High: Fetch race conditions (Bugs 2, 3, 5, 6)

Bugs 2, 3, 5, and 6 are all manifestations of the same root cause: no fetch invalidation. Fixing 2 and 3 inherently fixes 5 and 6.

- [x] **2.1** `src/composables/useStockData.ts` — Add a fetch generation counter. Increment it on each call to `fetchData`, capture the value before `await`, and bail after `await` if it no longer matches:

```ts
let fetchId = 0

async function fetchData(symbol: string) {
  const id = ++fetchId

  const cached = await load(symbol)
  if (id !== fetchId) return
  if (cached) {
    data.value = cached
    loading.value = false
    error.value = null
    return
  }

  loading.value = true
  error.value = null
  try {
    const result = await apiFetch<StockDataPoint[]>(
      `/history?symbol=${encodeURIComponent(symbol)}`,
    )
    if (id !== fetchId) return
    data.value = result
    await save(symbol, result)
  } catch (err) {
    if (id !== fetchId) return
    error.value = err
  } finally {
    if (id === fetchId) loading.value = false
  }
}
```

- [x] **2.2** `src/composables/useStockData.ts` — Reset `data.value`, `loading.value`, and `error.value` at the top of the watcher before calling `fetchData`, so stale data from a previous symbol is never visible while the new fetch is in flight:

```ts
watch(
  selectedSymbol,
  (s) => {
    data.value = null
    loading.value = false
    error.value = null
    if (s) fetchData(s)
  },
  { immediate: true },
)
```

- [x] **2.3** `src/composables/useStrategieData.ts` — Apply the same generation counter pattern as 2.1.

- [x] **2.4** `src/composables/useStrategieData.ts` — Reset `data.value`, `loading.value`, and `error.value` at the top of the watcher before calling `fetchData`:

```ts
watch(
  [symbol, strategy],
  async ([s, st]) => {
    data.value = null
    loading.value = false
    error.value = null
    if (!s || !st) return
    if (st !== 'sma') return
    fetchData(s, st)
  },
  { immediate: true },
)
```

This also resolves Bug 6 (stale SMA data visible during fetch) and Bug 10 (loading/error not cleared for non-SMA).

- [x] **2.5** Verify: add a 2-second artificial delay to `apiFetch` (e.g., `await new Promise(r => setTimeout(r, 2000))`), rapidly switch symbols, confirm the chart never shows mismatched data. Remove the delay after testing.

---

### Phase 3 — Medium: Memory leaks in chart components (Bug 4)

- [x] **3.1** `src/components/BaseStockChart.vue` — Extract the resize handler into a named function so it can be removed. Add `removeEventListener` in `onBeforeUnmount`:

```ts
const onResize = () => chart?.resize()

onMounted(async () => {
  // ... existing init ...
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
```

- [x] **3.2** `src/components/SmaStockChart.vue` — Same fix as 3.1.

- [x] **3.3** Verify: open browser DevTools → Performance → record a session while switching between "no strategy" (BaseStockChart) and "SMA" (SmaStockChart) multiple times. Confirm listener count in the Event Listeners panel does not grow.

---

### Phase 4 — Low: ECharts merge mode (Bug 8)

- [x] **4.1** `src/components/BaseStockChart.vue` — Change `chart.setOption({...})` to `chart.setOption({...}, { notMerge: true })` in `renderBaseChart`.

- [x] **4.2** `src/components/SmaStockChart.vue` — Same change in `renderChart`.

- [x] **4.3** Verify: switch between symbols with different data lengths, confirm no ghost series or axis labels remain from the previous symbol.

---

### Phase 5 — Low: State cleanup and selector sync (Bugs 9, 10)

Bug 10 is already resolved by Phase 2's watcher reset (task 2.4). This phase handles Bug 9.

- [x] **5.1** `src/components/SymbolSelector.vue` — Remove the manual `ref` initialization + `watch` pattern and replace with a `computed` that reads directly from `props.modelValue`:

```ts
const selected = computed(() => props.modelValue ?? null)
```

The `setSelected` function remains unchanged — it emits `update:modelValue` and the parent's `v-model` drives the prop back down.

- [x] **5.2** `src/components/StrategieSelector.vue` — Same refactor as 5.1.

- [x] **5.3** Verify: confirm symbol and strategy selection still works, toggling strategy off works, and the disabled state is respected.

---

### Phase 6 — Low: Cache robustness (Bug 11)

- [x] **6.1** `src/types/Cache.ts` — Add a `type` discriminator field to `CachedSeries`:

```ts
export interface CachedStockSeries {
  id: string
  type: 'stock'
  data: StockDataPoint[]
  expireAt: number
}

export interface CachedStrategySeries {
  id: string
  type: 'strategy'
  data: SMAResponse
  expireAt: number
}

export type CachedSeries = CachedStockSeries | CachedStrategySeries
```

- [x] **6.2** `src/composables/useStockData.ts` — Update `load()` to check `cached.type === 'stock'` instead of `Array.isArray(cached.data)`. Update `save()` to include `type: 'stock'`.

- [x] **6.3** `src/composables/useStrategieData.ts` — Update `load()` to check `cached.type === 'strategy'` instead of `'strategy' in cached.data`. Update `save()` to include `type: 'strategy'`.

- [x] **6.4** `src/db.ts` — Bump the Dexie schema version to `2` so existing untyped cache entries are dropped:

```ts
db.version(2).stores({
  stockdata: 'id, expireAt',
})
```

- [x] **6.5** Verify: clear IndexedDB in DevTools, reload, confirm data is cached and served correctly with the new `type` field.

---

### Phase 7 — Low: Deduplicate `nextMidnightNewYork` (Bug 12)

- [x] **7.1** Create `src/utils/nextMidnightNewYork.ts` with the function extracted from `useStockData.ts`:

```ts
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

export function nextMidnightNewYork(): number {
  const nowNY = dayjs().tz('America/New_York')
  return nowNY.add(1, 'day').startOf('day').valueOf()
}
```

- [x] **7.2** `src/composables/useStockData.ts` — Remove the local `nextMidnightNewYork` function and the dayjs plugin setup. Import from `@/utils/nextMidnightNewYork`.

- [x] **7.3** `src/composables/useStrategieData.ts` — Same replacement as 7.2.

- [x] **7.4** Verify: `npm run type-check` passes, cache expiry still works.

---

### Phase 8 — Final validation

- [x] **8.1** Run `npm run type-check` — must pass with zero errors.
- [x] **8.2** Run `npm run lint` — must pass.
- [x] **8.3** Run `npm run dev:mock` and manually test the full flow:
  - Select a symbol → chart renders.
  - Select SMA strategy → SMA overlay appears with live ticks.
  - Rapidly switch symbols → no cross-symbol data, no stale overlays, loading spinner appears and disappears correctly.
  - Toggle log scale → zoom preserved.
  - Switch strategy off → base chart only.
  - Resize the browser window → chart resizes, only one handler fires.
  - Open DevTools → no console errors, no leaked event listeners, IndexedDB cache entries have `type` field.

---

### Task Dependency Graph

```
Phase 1 (WS leak)
  └──> Phase 2 (fetch races) ─── can run independently but logically follows
         └──> Phase 5 (selector sync, depends on 2.4 resolving Bug 10)
Phase 3 (resize leak) ─── fully independent
Phase 4 (ECharts merge) ─── fully independent
Phase 6 (cache types) ─── fully independent
Phase 7 (dedup utility) ─── fully independent
Phase 8 (validation) ─── depends on all above
```

Phases 1, 3, 4, 6, 7 have no mutual dependencies and can be done in any order or in parallel. Phase 2 should be done before Phase 5. Phase 8 is always last.
