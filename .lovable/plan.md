

## Problem

The Kalshi fetch in `market-scan` uses only the `/events` endpoint, which misses:
1. **Markets ending today** - no time-based filtering at all
2. **Sports markets** - the series-ticker approach only works if Kalshi returns them under `/events`; many short-term game markets get missed
3. **Direct market discovery** - the `/markets` endpoint with `min_close_ts`/`max_close_ts` is never used

The user has provided the correct Kalshi API docs showing `GET /markets` supports `min_close_ts`, `max_close_ts`, and `status=open` with up to 1000 results per page.

---

## Plan

### 1. Add a direct `GET /markets` fetch with today's close-time window

In `supabase/functions/market-scan/index.ts`, add a third Kalshi fetch step:

- Compute today's start-of-day and end-of-day as Unix timestamps (seconds)
- Call `GET /markets?status=open&min_close_ts={startOfDay}&max_close_ts={endOfDay}&limit=1000`
- This directly captures all Kalshi markets closing today (sports, politics, weather, everything)
- Merge results into `allMarkets` before dedup

### 2. Add a broader sports fetch via `GET /markets` with category

- Call `GET /markets?status=open&limit=1000&category=Sports` (or iterate with cursor if needed)
- This catches sports markets the series-ticker approach misses

### 3. Add a high-volume fetch

- Call `GET /markets?status=open&limit=200` sorted by default (Kalshi returns high-volume first)
- Ensures top-traded markets are always captured regardless of category

### 4. Keep existing fetches as-is

The `/events` paginated fetch and sports-series fetch remain for broad coverage. The new fetches layer on top, and the existing dedup logic (`seen` Set by ticker) prevents duplicates.

---

### Technical detail

**New fetch functions added to `fetchKalshiMarkets()`:**

```text
Step 3: GET /markets?status=open&min_close_ts=<todayStart>&max_close_ts=<todayEnd>&limit=1000
Step 4: GET /markets?status=open&limit=1000  (broad catch-all via /markets endpoint)
```

Both feed into `allMarkets[]` before the existing dedup/filter/map pipeline. No changes needed to the Dashboard or client code — the edge function just returns more markets.

**Files changed:** `supabase/functions/market-scan/index.ts` only.

