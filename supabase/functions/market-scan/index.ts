import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GAMMA_API = "https://gamma-api.polymarket.com";
const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

async function fetchPolymarketMarkets() {
  const minEnd = new Date().toISOString().split("T")[0];
  const urls = [
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=volume&ascending=false&end_date_min=${minEnd}`,
    `${GAMMA_API}/markets?limit=100&active=true&closed=false&archived=false&order=liquidity&ascending=false`,
  ];

  const allMarkets: any[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const rows = await res.json();
      const markets = Array.isArray(rows) ? rows : rows?.data ?? [];
      allMarkets.push(...markets);
    } catch { /* next */ }
  }

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

async function fetchKalshiMarkets() {
  try {
    // Use events endpoint with nested markets for better data
    const res = await fetch(`${KALSHI_BASE}/events?limit=100&status=open&with_nested_markets=true`, {
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    });
    if (!res.ok) {
      console.error(`Kalshi events API returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    const events = data.events ?? [];
    const allMarkets: any[] = [];
    for (const event of events) {
      const ms = event.markets ?? [];
      for (const m of ms) {
        m._eventTitle = event.title;
        m._eventCategory = event.category;
        allMarkets.push(m);
      }
    }

    // Kalshi v2 uses _dollars and _fp suffixed fields
    const parseDollars = (v: any) => Number(String(v ?? "0").replace(/[^0-9.\-]/g, "")) || 0;

    return allMarkets.filter((m: any) => {
      const ticker = m.ticker ?? "";
      if (ticker.startsWith("KXMVE")) return false;
      const yesBid = parseDollars(m.yes_bid_dollars);
      const yesAsk = parseDollars(m.yes_ask_dollars);
      if (yesBid === 0 && yesAsk === 0) return false;
      const oi = parseDollars(m.open_interest_fp);
      const vol = parseDollars(m.volume_fp);
      // Relax liquidity filter — Kalshi reports liquidity_dollars as 0 for most markets
      // Use open_interest or volume instead
      if (oi === 0 && vol === 0) return false;
      const lastPrice = parseDollars(m.last_price_dollars);
      if (lastPrice >= 0.90 || (lastPrice > 0 && lastPrice <= 0.10)) return false;
      return true;
    }).map((m: any) => {
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
    });
  } catch (e) {
    console.error("Kalshi fetch error:", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider"); // "kalshi", "polymarket", or null for both

    const results: any[] = [];
    const status: Record<string, string> = {};

    if (!provider || provider === "polymarket") {
      try {
        const poly = await fetchPolymarketMarkets();
        results.push(...poly);
        status.polymarket = poly.length > 0 ? "connected" : "empty";
        console.log(`[scan] Polymarket: ${poly.length} markets`);
      } catch (e) {
        status.polymarket = "error";
        console.error("[scan] Polymarket error:", e);
      }
    }

    if (!provider || provider === "kalshi") {
      try {
        const kalshi = await fetchKalshiMarkets();
        results.push(...kalshi);
        status.kalshi = kalshi.length > 0 ? "connected" : "empty";
        console.log(`[scan] Kalshi: ${kalshi.length} markets`);
      } catch (e) {
        status.kalshi = "error";
        console.error("[scan] Kalshi error:", e);
      }
    }

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
