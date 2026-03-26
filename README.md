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

## Integrations API (Polymarket + Kalshi)

This repo now includes a backend integration service at `server/integrations-server.mjs`.

### Run it

```bash
export INTEGRATIONS_MASTER_KEY='set-a-strong-random-value'
node server/integrations-server.mjs
```

Default port: `8787`.

Set frontend API base if needed:

```bash
VITE_INTEGRATIONS_API_BASE=http://localhost:8787
```

### Capability matrix (implemented)

| Provider | Public endpoints | Authenticated endpoints | Credentials | Auth/signing | Fee sync |
|---|---|---|---|---|---|
| Polymarket | `GET /markets` on CLOB | Trading paths only if API key/secret/passphrase are configured | API key id, API secret, API passphrase, optional wallet private key | CLOB L2 model expected; app keeps trading disabled unless authenticated config passes provider tests | `GET /fee-rate` |
| Kalshi | `GET /markets` | `GET /portfolio/balance` for auth validation | API Key ID + RSA private key PEM | `KALSHI-ACCESS-*` headers with RSA signature over timestamp+method+path | `GET /series/fee_changes` raw payload normalized + preserved |

### Security model

- Secrets are never returned to the UI after save.
- UI receives masked metadata only.
- Credentials are stored server-side in `server/data/integrations.json`.
- Server refuses saving new secrets if `INTEGRATIONS_MASTER_KEY` is missing.

## Current blockers to full go-live

- No live order placement flow is wired yet in the trade ticket.
- Kalshi fee data is series-level and may require additional per-market mapping logic.
- Journal and strategy backtest pages require real persistence/backtest services.
