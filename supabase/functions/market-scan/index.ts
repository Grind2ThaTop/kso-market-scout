import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { constants, createSign } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GAMMA_API = "https://gamma-api.polymarket.com";
const KALSHI_PUBLIC = "https://api.elections.kalshi.com/trade-api/v2";
const KALSHI_TRADING = "https://trading-api.kalshi.com/trade-api/v2";

const KALSHI_API_KEY_ID = Deno.env.get("KALSHI_API_KEY_ID");
const KALSHI_PRIVATE_KEY = Deno.env.get("KALSHI_PRIVATE_KEY");

/* ─── Kalshi Auth ─── */

function normalizePem(raw: string): string {
  const normalizedRaw = raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();

  if (normalizedRaw.includes("-----BEGIN") && normalizedRaw.split("\n").length > 3) {
    return normalizedRaw;
  }

  const isRsa = normalizedRaw.includes("RSA PRIVATE KEY");
  const header = isRsa ? "-----BEGIN RSA PRIVATE KEY-----" : "-----BEGIN PRIVATE KEY-----";
  const footer = isRsa ? "-----END RSA PRIVATE KEY-----" : "-----END PRIVATE KEY-----";
  const b64 = normalizedRaw
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const lines = b64.match(/.{1,64}/g) || [];
  return [header, ...lines, footer].join("\n");
}

function signKalshi(method: string, path: string, body = "") {
  if (!KALSHI_API_KEY_ID || !KALSHI_PRIVATE_KEY) return null;
  const timestamp = String(Date.now());
  const pathWithoutQuery = path.split("?")[0];
  const signedPath = `/trade-api/v2${pathWithoutQuery}`;
  const payload = `${timestamp}${method.toUpperCase()}${signedPath}${body}`;
  const pem = normalizePem(KALSHI_PRIVATE_KEY);
  const signer = createSign("RSA-SHA256");
  signer.update(payload);
  const signature = signer.sign(
    {
      key: pem,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    },
    "base64"
  );
  return {
    "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID,
    "KALSHI-ACCESS-SIGNATURE": signature,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

/* ─── Polymarket ─── */

async function fetchPolymarketMarkets() {
  const minEnd = new Date().toISOString().split("T")[0];
  const urls = [
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=volume&ascending=false&end_date_min=${minEnd}`,
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=liquidity&ascending=false`,
    // Sports-specific pulls
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=volume&ascending=false&tag=sports`,
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=volume&ascending=false&tag=nba`,
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=volume&ascending=false&tag=nfl`,
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=volume&ascending=false&tag=mlb`,
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=volume&ascending=false&tag=soccer`,
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=volume&ascending=false&tag=mma`,
  ];

  const allMarkets: any[] = [];
  const fetches = urls.map(async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const rows = await res.json();
      return Array.isArray(rows) ? rows : rows?.data ?? [];
    } catch { return []; }
  });

  const results = await Promise.all(fetches);
  for (const batch of results) allMarkets.push(...batch);

  // Deduplicate
  const seen = new Set<string>();
  return allMarkets.filter(m => {
    const id = m.id ?? m.conditionId;
    if (seen.has(id)) return false;
    seen.add(id);
    if (m.closed === true || m.active === false) return false;
    const vol = Number(m.volumeNum ?? m.volume ?? 0);
    const liq = Number(m.liquidityNum ?? m.liquidity ?? 0);
    if (vol === 0 && liq === 0) return false;
    const endDate = m.endDate ?? m.end_date;
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      if (Number.isFinite(endMs) && endMs < Date.now()) return false;
    }
    return true;
  }).map(m => {
    const prices = m.outcomePrices ? (typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices) : [];
    const yesPrice = Number(prices[0] ?? m.lastTradePrice ?? 0.5);
    const vol = Number(m.volumeNum ?? m.volume ?? 0);
    const liq = Number(m.liquidityNum ?? m.liquidity ?? 0);
    return {
      id: String(m.id ?? m.conditionId),
      ticker: String(m.ticker ?? m.conditionId ?? m.id).toUpperCase(),
      title: String(m.question ?? m.title ?? "Untitled"),
      platform: "polymarket",
      slug: m.slug ?? m.conditionId,
      conditionSlug: m.conditionId,
      marketSlug: m.slug ?? m.conditionId,
      eventSlug: m.events?.[0]?.slug ?? m.slug ?? m.conditionId,
      category: m.groupItemTitle ?? m.category ?? m.tags?.[0] ?? m.question ?? "other",
      endDate: m.endDate ?? m.end_date,
      rules: m.description ?? "See exchange rules.",
      lastTradePrice: yesPrice,
      outcomePrices: prices,
      volume: vol,
      volumeNum: vol,
      liquidity: liq,
      liquidityNum: liq,
      bestYesBid: Math.max(0.01, yesPrice - 0.01),
      bestYesAsk: Math.min(0.99, yesPrice + 0.01),
      bestNoBid: Math.max(0.01, (1 - yesPrice) - 0.01),
      bestNoAsk: Math.min(0.99, (1 - yesPrice) + 0.01),
      spread: 0.02,
      oneHourPriceChange: Number(m.oneHourPriceChange ?? 0),
      oneDayPriceChange: Number(m.oneDayPriceChange ?? 0),
      status: "active",
    };
  });
}

/* ─── Kalshi ─── */

const parseDollars = (v: any) => Number(String(v ?? "0").replace(/[^0-9.\-]/g, "")) || 0;

function mapKalshiMarket(m: any) {
  const yesBid = parseDollars(m.yes_bid_dollars);
  const yesAsk = parseDollars(m.yes_ask_dollars);
  const noBid = parseDollars(m.no_bid_dollars);
  const noAsk = parseDollars(m.no_ask_dollars);
  const lastPrice = parseDollars(m.last_price_dollars);
  const vol = parseDollars(m.volume_fp);
  const vol24h = parseDollars(m.volume_24h_fp);
  const oi = parseDollars(m.open_interest_fp);
  const prevPrice = parseDollars(m.previous_price_dollars);

  return {
    id: m.ticker ?? m.id,
    ticker: (m.ticker ?? m.id ?? "").toUpperCase(),
    title: m.title ?? m._eventTitle ?? "Untitled",
    platform: "kalshi",
    marketSlug: m.ticker,
    eventSlug: m.event_ticker ?? m.series_ticker,
    seriesSlug: m._seriesTicker ?? m.series_ticker ?? m.event_ticker?.replace(/-[0-9].*$/, ''),
    category: m._eventCategory ?? m.category ?? m.title ?? "other",
    endDate: m.close_time ?? m.expiration_time,
    rules: m.rules_primary ?? "See Kalshi rules.",
    lastTradePrice: lastPrice,
    volume: vol24h || vol,
    volumeNum: vol24h || vol,
    liquidity: oi,
    liquidityNum: oi,
    bestYesBid: yesBid,
    bestYesAsk: yesAsk,
    bestNoBid: noBid,
    bestNoAsk: noAsk,
    spread: Math.abs(yesAsk - yesBid),
    oneHourPriceChange: 0,
    oneDayPriceChange: prevPrice > 0 ? lastPrice - prevPrice : 0,
    status: m.status ?? "active",
    open_interest: oi,
  };
}

function filterKalshiMarket(m: any, seen: Set<string>): boolean {
  const ticker = m.ticker ?? "";
  if (seen.has(ticker)) return false;
  seen.add(ticker);
  if (ticker.startsWith("KXMVE")) return false;
  if (m.status === "finalized" || m.status === "closed") return false;
  const yesBid = parseDollars(m.yes_bid_dollars);
  const yesAsk = parseDollars(m.yes_ask_dollars);
  if (yesBid === 0 && yesAsk === 0) return false;
  const oi = parseDollars(m.open_interest_fp);
  const vol = parseDollars(m.volume_fp);
  if (oi === 0 && vol === 0) return false;
  const lastPrice = parseDollars(m.last_price_dollars);
  if (lastPrice >= 0.90 || (lastPrice > 0 && lastPrice <= 0.10)) return false;
  return true;
}

async function fetchKalshiPublicMarkets() {
  const allMarkets: any[] = [];
  let cursor = "";
  let pages = 0;
  const MAX_PAGES = 5;

  while (pages < MAX_PAGES) {
    const cursorParam = cursor ? `&cursor=${cursor}` : "";
    const res = await fetch(
      `${KALSHI_PUBLIC}/events?limit=100&status=open&with_nested_markets=true${cursorParam}`,
      { headers: { "Content-Type": "application/json", "Accept": "application/json" } }
    );
    if (!res.ok) break;
    const data = await res.json();
    const events = data.events ?? [];
    if (events.length === 0) break;

    for (const event of events) {
      for (const m of (event.markets ?? [])) {
        m._eventTitle = event.title;
        m._eventCategory = event.category;
        m._seriesTicker = event.series_ticker;
      }
      allMarkets.push(...(event.markets ?? []));
    }

    cursor = data.cursor ?? "";
    if (!cursor) break;
    pages++;
  }

  console.log(`[scan] Kalshi public: ${allMarkets.length} raw markets (${pages + 1} pages)`);
  return allMarkets;
}

async function fetchKalshiAuthMarkets(): Promise<any[]> {
  const headers = signKalshi("GET", "/markets?limit=200&status=open");
  if (!headers) {
    console.log("[scan] Kalshi auth: no credentials, skipping");
    return [];
  }

  const allMarkets: any[] = [];
  let cursor = "";
  let pages = 0;
  const MAX_PAGES = 5; // up to 1000 markets from authenticated API

  while (pages < MAX_PAGES) {
    const cursorParam = cursor ? `&cursor=${cursor}` : "";
    const path = `/markets?limit=200&status=open${cursorParam}`;
    const authHeaders = signKalshi("GET", path);
    if (!authHeaders) break;

    try {
      const res = await fetch(`${KALSHI_TRADING}${path}`, { headers: authHeaders });
      if (!res.ok) {
        console.error(`[scan] Kalshi auth API ${res.status}: ${await res.text().catch(() => '')}`);
        break;
      }
      const data = await res.json();
      const markets = data.markets ?? [];
      if (markets.length === 0) break;
      allMarkets.push(...markets);
      cursor = data.cursor ?? "";
      if (!cursor) break;
      pages++;
    } catch (e) {
      console.error("[scan] Kalshi auth fetch error:", e);
      break;
    }
  }

  console.log(`[scan] Kalshi auth: ${allMarkets.length} markets (${pages + 1} pages)`);
  return allMarkets;
}

async function fetchKalshiMarkets() {
  try {
    // Fetch from both public (elections) and authenticated (trading) APIs in parallel
    const [publicMarkets, authMarkets] = await Promise.all([
      fetchKalshiPublicMarkets(),
      fetchKalshiAuthMarkets().catch((e) => {
        console.error("[scan] Kalshi auth failed:", e);
        return [] as any[];
      }),
    ]);

    const combined = [...publicMarkets, ...authMarkets];
    console.log(`[scan] Kalshi combined: ${combined.length} raw markets`);

    const seen = new Set<string>();
    return combined
      .filter(m => filterKalshiMarket(m, seen))
      .map(mapKalshiMarket);
  } catch (e) {
    console.error("Kalshi fetch error:", e);
    return [];
  }
}

/* ─── Handler ─── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    const results: any[] = [];
    const status: Record<string, string> = {};

    const promises: Promise<void>[] = [];

    if (!provider || provider === "polymarket") {
      promises.push((async () => {
        try {
          const poly = await fetchPolymarketMarkets();
          results.push(...poly);
          status.polymarket = poly.length > 0 ? "connected" : "empty";
          console.log(`[scan] Polymarket: ${poly.length} markets`);
        } catch (e) {
          status.polymarket = "error";
          console.error("[scan] Polymarket error:", e);
        }
      })());
    }

    if (!provider || provider === "kalshi") {
      promises.push((async () => {
        try {
          const kalshi = await fetchKalshiMarkets();
          results.push(...kalshi);
          status.kalshi = kalshi.length > 0 ? "connected" : "empty";
          console.log(`[scan] Kalshi: ${kalshi.length} markets`);
        } catch (e) {
          status.kalshi = "error";
          console.error("[scan] Kalshi error:", e);
        }
      })());
    }

    await Promise.all(promises);

    return new Response(JSON.stringify({
      markets: results,
      providerStatus: status,
      fetchedAt: new Date().toISOString(),
      count: results.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[scan] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
