# KSO Market Scout

Production-safe prediction market scanner UI using **live market data only**.

## Live data configuration

1. Copy `.env.example` to `.env`.
2. Set `VITE_MARKET_DATA_URL` to your live market feed endpoint.
3. Optionally set `VITE_MARKET_DATA_API_KEY` if your provider requires auth.
4. Start the app with `npm run dev`.

The app expects `VITE_MARKET_DATA_URL` to return one of:
- `[{...}]`
- `{ "data": [{...}] }`
- `{ "markets": [{...}] }`

Each market row should include id/title plus quote fields (`bestYesBid`/`bestYesAsk` or equivalent).

## Current blockers to full go-live

- No dedicated historical candles endpoint is wired yet.
- No live orderbook/trade-print endpoint is wired yet.
- No execution/order placement API is connected (paper planning only).
- Journal and strategy backtest pages require real persistence/backtest services.
