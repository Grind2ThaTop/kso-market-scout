# Prediction Market Integration Test Checklist

## Unit tests
- [ ] Polymarket L2 signing helper produces deterministic HMAC signatures.
- [ ] Error-mapping helper converts provider failures into app-level error codes.
- [ ] Credential parsing rejects missing required fields.

## Integration tests (public)
- [ ] `GET /api/prediction-markets/markets?provider=polymarket` returns normalized markets.
- [ ] `GET /api/prediction-markets/markets?provider=kalshi` returns normalized markets.
- [ ] `GET /api/prediction-markets/realtime?provider=...` returns websocket capability metadata.

## Mocked/authenticated flow checks
- [ ] Save credentials endpoint persists masked metadata without returning secrets.
- [ ] Test credentials endpoint marks invalid credentials as `invalid`.
- [ ] Sync account endpoint returns balances, positions, orders, fills when credentials are valid.

## Manual smoke scripts
- [ ] `node server/scripts/smoke-polymarket.mjs`
- [ ] `node server/scripts/smoke-kalshi.mjs`
