# KSO Market Scout

Prediction market scanner UI with rebuilt **Kalshi** and **Polymarket** provider integrations.

## Run

```bash
npm install
INTEGRATIONS_MASTER_KEY='replace-with-random-32+chars' npm run dev
```

Frontend defaults to `http://localhost:8787` for integration APIs unless `VITE_INTEGRATIONS_API_BASE` is set.

## New prediction provider architecture

- `PredictionMarketProvider` interface/base class.
- `KalshiProvider` for Kalshi REST + auth signing.
- `PolymarketProvider` for public Gamma data and authenticated CLOB trading.
- Strict request validation via zod.
- Normalized market model with raw payload preservation.
- Shared resilience layer: throttling + retry/backoff + circuit breaker.

## Environment variables

### Backend
- `INTEGRATIONS_PORT` (default `8787`)
- `INTEGRATIONS_MASTER_KEY` (required for encrypted secret storage)

### Frontend
- `VITE_INTEGRATIONS_API_BASE` (optional; defaults to same origin)
- Existing scanner vars (`VITE_MARKET_DATA_URL`, etc.) remain supported.

## Credentials requirements

### Kalshi
- `apiKeyId`
- `privateKeyPem`
- `environment`: `prod` or `demo`

### Polymarket (CLOB trading)
- `apiKey`
- `apiSecret`
- `apiPassphrase`
- optional `walletAddress`

Public Polymarket market data uses Gamma endpoints and does **not** require wallet auth.

## Demo vs production

- Kalshi supports `prod` and `demo` base URLs.
- Polymarket is configured for production CLOB and public Gamma endpoints.

## Auth model summary

- **Kalshi**: RSA-PSS signature headers (`KALSHI-ACCESS-*`) on authenticated requests.
- **Polymarket**: public Gamma reads unauthenticated; trading uses L2 API credentials and HMAC-SHA256 signed headers.

## Endpoints

- `POST /api/prediction-markets/credentials/save`
- `POST /api/prediction-markets/credentials/test`
- `POST /api/prediction-markets/sync-account`
- `GET /api/prediction-markets/markets?provider=...`
- `GET /api/prediction-markets/positions?provider=...`
- `GET /api/prediction-markets/orders?provider=...`
- `POST /api/prediction-markets/orders/place`
- `POST /api/prediction-markets/orders/cancel`
- `POST /api/prediction-markets/orders/cancel-all`
- `GET /api/prediction-markets/realtime?provider=...`

## Smoke scripts

```bash
node server/scripts/smoke-polymarket.mjs
node server/scripts/smoke-kalshi.mjs
```

## Known limitations

- Real credential validation for private account/trading flows requires valid live keys.
- Websocket metadata/reconnect scaffolding is present, but channel subscription handlers are intentionally left for runtime-specific wiring.
- Polymarket L1 wallet-derived key creation flow is not yet automated in this repo; expects pre-generated L2 credentials.
