const BASE = process.env.INTEGRATIONS_API_BASE ?? 'http://localhost:8787';

async function run() {
  const markets = await fetch(`${BASE}/api/prediction-markets/markets?provider=polymarket`).then((r) => r.json());
  console.log('polymarket markets:', Array.isArray(markets.markets) ? markets.markets.length : 0);
  const realtime = await fetch(`${BASE}/api/prediction-markets/realtime?provider=polymarket`).then((r) => r.json());
  console.log('polymarket realtime:', realtime.realtime?.supported);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
