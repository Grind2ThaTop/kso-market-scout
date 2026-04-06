import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { constants, createSign } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const GAMMA_API = "https://gamma-api.polymarket.com";

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

async function signKalshi(apiKeyId: string, privateKeyPem: string, method: string, path: string, body = "") {
  const timestamp = String(Date.now());
  const pathWithoutQuery = path.split("?")[0];
  const signedPath = `/trade-api/v2${pathWithoutQuery}`;
  const payload = `${timestamp}${method.toUpperCase()}${signedPath}${body}`;
  const pem = normalizePem(privateKeyPem);
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
    "KALSHI-ACCESS-KEY": apiKeyId,
    "KALSHI-ACCESS-SIGNATURE": signature,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "Content-Type": "application/json",
  };
}

async function kalshiRequest(apiKeyId: string, privateKey: string, path: string, method = "GET", body?: Record<string, unknown>) {
  const bodyStr = body ? JSON.stringify(body) : "";
  const headers = await signKalshi(apiKeyId, privateKey, method, path, bodyStr);
  const res = await fetch(`${KALSHI_BASE}${path}`, { method, headers, body: bodyStr || undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Kalshi ${method} ${path} [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

// ─── MARKET DATA FETCHING ───
interface RawMarket {
  id: string;
  title: string;
  platform: "polymarket" | "kalshi";
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidityScore: number;
  spread: number;
  bestYesAsk: number;
  bestNoAsk: number;
  momentum1h: number;
  momentum24h: number;
  eventEnd: string;
  marketSlug?: string;
}

async function fetchPolymarketMarkets(): Promise<RawMarket[]> {
  try {
    const minEnd = new Date().toISOString().split("T")[0];
    const res = await fetch(`${GAMMA_API}/markets?limit=80&active=true&closed=false&archived=false&order=volume&ascending=false&end_date_min=${minEnd}`);
    if (!res.ok) return [];
    const rows = await res.json();
    const markets = Array.isArray(rows) ? rows : rows?.data ?? [];
    return markets
      .filter((m: any) => !m.closed && m.active !== false)
      .map((m: any) => {
        const prices = m.outcomePrices ? (typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices) : [];
        const yesPrice = Number(prices[0] ?? m.lastTradePrice ?? 0.5);
        const noPrice = 1 - yesPrice;
        const bestBid = Math.max(0.01, yesPrice - 0.01);
        const bestAsk = Math.min(0.99, yesPrice + 0.01);
        return {
          id: String(m.id ?? m.conditionId),
          title: String(m.question ?? m.title ?? "Untitled"),
          platform: "polymarket" as const,
          yesPrice, noPrice,
          volume24h: Number(m.volumeNum ?? m.volume ?? 0),
          liquidityScore: Math.min(100, Number(m.liquidityNum ?? m.liquidity ?? 0) / 500),
          spread: bestAsk - bestBid,
          bestYesAsk: bestAsk,
          bestNoAsk: Math.min(0.99, noPrice + 0.01),
          momentum1h: Number(m.oneHourPriceChange ?? 0),
          momentum24h: Number(m.oneDayPriceChange ?? 0),
          eventEnd: m.endDate ?? m.end_date ?? new Date(Date.now() + 86400000).toISOString(),
          marketSlug: m.slug ?? m.conditionId,
        };
      });
  } catch (e) {
    console.error("Polymarket fetch error:", e);
    return [];
  }
}

async function fetchKalshiMarkets(): Promise<RawMarket[]> {
  try {
    const res = await fetch(`${KALSHI_BASE}/events?limit=100&status=open&with_nested_markets=true`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const events = data.events ?? [];
    const allMarkets: any[] = [];
    for (const event of events) {
      for (const m of (event.markets ?? [])) {
        m._eventTitle = event.title;
        allMarkets.push(m);
      }
    }
    const parseDollars = (v: any) => Number(String(v ?? "0").replace(/[^0-9.\-]/g, "")) || 0;

    return allMarkets
      .filter((m: any) => {
        const ticker = m.ticker ?? "";
        if (ticker.startsWith("KXMVE")) return false;
        const yesBid = parseDollars(m.yes_bid_dollars);
        const yesAsk = parseDollars(m.yes_ask_dollars);
        if (yesBid === 0 && yesAsk === 0) return false;
        const oi = parseDollars(m.open_interest_fp);
        const vol = parseDollars(m.volume_fp);
        if (oi === 0 && vol === 0) return false;
        const lastPrice = parseDollars(m.last_price_dollars);
        if (lastPrice >= 0.90 || (lastPrice > 0 && lastPrice <= 0.10)) return false;
        return true;
      })
      .map((m: any) => {
        const yesBid = parseDollars(m.yes_bid_dollars);
        const yesAsk = parseDollars(m.yes_ask_dollars);
        const lastPrice = parseDollars(m.last_price_dollars);
        const noPrice = 1 - lastPrice;
        const oi = parseDollars(m.open_interest_fp);
        const vol = parseDollars(m.volume_24h_fp) || parseDollars(m.volume_fp);
        const prevPrice = parseDollars(m.previous_price_dollars);
        return {
          id: m.ticker ?? m.id,
          title: m.title ?? m._eventTitle ?? "Untitled",
          platform: "kalshi" as const,
          yesPrice: lastPrice, noPrice,
          volume24h: vol,
          liquidityScore: Math.min(100, oi / 50),
          spread: Math.abs(yesAsk - yesBid),
          bestYesAsk: yesAsk,
          bestNoAsk: parseDollars(m.no_ask_dollars),
          momentum1h: 0,
          momentum24h: prevPrice > 0 ? lastPrice - prevPrice : 0,
          eventEnd: m.close_time ?? m.expiration_time ?? new Date(Date.now() + 86400000).toISOString(),
          marketSlug: m.ticker,
        };
      });
  } catch (e) {
    console.error("Kalshi fetch error:", e);
    return [];
  }
}

// ─── SIGNAL GENERATION (same logic as frontend) ───
interface Signal {
  marketId: string;
  marketTitle: string;
  provider: string;
  direction: "YES" | "NO";
  score: number;
  confidence: number;
  entryZone: [number, number];
  targetPrice: number;
  invalidationPrice: number;
  riskReward: number;
  setupType: string;
  thesis: string;
  netEdge: number;
}

function generateSignals(markets: RawMarket[]): Signal[] {
  const signals: Signal[] = [];

  for (const m of markets) {
    const mid = m.yesPrice;
    if (mid >= 0.85 || mid <= 0.15) continue;

    const spreadPct = m.spread;
    const yesProfitRoom = Math.max(0, 0.95 - m.bestYesAsk);
    const noProfitRoom = Math.max(0, 0.95 - m.bestNoAsk);
    const totalCost = 0.03 * 2 + 0.01 * 2 + spreadPct;
    const yesNetEdge = yesProfitRoom - totalCost;
    const noNetEdge = noProfitRoom - totalCost;

    const volumeToLiq = m.liquidityScore > 0 ? m.volume24h / (m.liquidityScore * 100) : 0;
    const volumeSpike = Math.min(1, volumeToLiq / 5);
    const momStrength = Math.min(1, Math.abs(m.momentum1h) * 8 + Math.abs(m.momentum24h) * 3);
    const spreadQuality = spreadPct < 0.02 ? 1 : spreadPct < 0.04 ? 0.75 : spreadPct < 0.06 ? 0.5 : spreadPct < 0.08 ? 0.25 : 0;
    const whaleSignal = m.volume24h > 5000 && Math.abs(m.momentum1h) > 0.02;
    const hoursToExpiry = (new Date(m.eventEnd).getTime() - Date.now()) / 3_600_000;
    const timePressure = hoursToExpiry < 6 ? 1 : hoursToExpiry < 24 ? 0.7 : hoursToExpiry < 72 ? 0.4 : 0.15;

    const hasMinLiquidity = m.liquidityScore > 20;
    const tradableSpread = spreadPct < 0.08;
    if (!hasMinLiquidity || !tradableSpread) continue;

    const yesSharpScore = (m.momentum1h > 0.005 ? m.momentum1h * 10 : 0) + (m.momentum24h > 0.01 ? m.momentum24h * 5 : 0) + volumeSpike * 0.3 + (whaleSignal && m.momentum1h > 0 ? 0.3 : 0);
    const noSharpScore = (m.momentum1h < -0.005 ? Math.abs(m.momentum1h) * 10 : 0) + (m.momentum24h < -0.01 ? Math.abs(m.momentum24h) * 5 : 0) + volumeSpike * 0.3 + (whaleSignal && m.momentum1h < 0 ? 0.3 : 0);

    const yesValue = mid >= 0.25 && mid <= 0.75 && yesNetEdge > 0.01;
    const noValue = mid >= 0.25 && mid <= 0.75 && noNetEdge > 0.01;

    let direction: "YES" | "NO" | null = null;
    let bestEdge = 0;
    let thesis = "";
    let setupType = "Spread Capture";

    if (yesSharpScore > 0.15 && yesNetEdge > 0.005 && yesValue) {
      direction = "YES"; bestEdge = yesNetEdge;
      thesis = `Sharp YES flow: +${(m.momentum1h * 100).toFixed(1)}¢/1h, vol ${(volumeSpike * 100).toFixed(0)}%, edge ${(yesNetEdge * 100).toFixed(1)}¢`;
      setupType = whaleSignal ? "Whale Play" : "Sharp Flow";
    } else if (noSharpScore > 0.15 && noNetEdge > 0.005 && noValue) {
      direction = "NO"; bestEdge = noNetEdge;
      thesis = `Sharp NO flow: ${(m.momentum1h * 100).toFixed(1)}¢/1h, vol ${(volumeSpike * 100).toFixed(0)}%, edge ${(noNetEdge * 100).toFixed(1)}¢`;
      setupType = whaleSignal ? "Whale Play" : "Sharp Flow";
    } else if (yesNetEdge > 0.03 && mid >= 0.30 && mid <= 0.70 && spreadQuality >= 0.5) {
      direction = "YES"; bestEdge = yesNetEdge;
      thesis = `Value YES: ${(m.bestYesAsk * 100).toFixed(0)}¢, room ${(yesProfitRoom * 100).toFixed(0)}¢, edge ${(yesNetEdge * 100).toFixed(1)}¢`;
      setupType = "Value Entry";
    } else if (noNetEdge > 0.03 && mid >= 0.30 && mid <= 0.70 && spreadQuality >= 0.5) {
      direction = "NO"; bestEdge = noNetEdge;
      thesis = `Value NO: ${(m.bestNoAsk * 100).toFixed(0)}¢, room ${(noProfitRoom * 100).toFixed(0)}¢, edge ${(noNetEdge * 100).toFixed(1)}¢`;
      setupType = "Value Entry";
    }

    if (!direction) continue;

    const edgeScore = Math.min(1, bestEdge * 8);
    const sharpScore = Math.min(1, Math.max(yesSharpScore, noSharpScore));
    const score = Math.round((edgeScore * 0.35 + sharpScore * 0.25 + spreadQuality * 0.20 + (m.liquidityScore / 100) * 0.10 + timePressure * 0.10) * 100);
    const confidence = Math.min(95, Math.max(15, Math.round(edgeScore * 30 + sharpScore * 25 + spreadQuality * 20 + (m.liquidityScore / 100) * 15 + timePressure * 10)));

    const entryPrice = direction === "YES" ? m.bestYesAsk : m.bestNoAsk;
    const profitRoom = direction === "YES" ? yesProfitRoom : noProfitRoom;
    const targetPrice = Math.min(0.92, entryPrice + Math.max(0.06, profitRoom * 0.65));
    const invalidationPrice = Math.max(0.03, entryPrice - Math.max(0.04, profitRoom * 0.3));
    const riskReward = targetPrice - entryPrice > 0 && entryPrice - invalidationPrice > 0
      ? +((targetPrice - entryPrice) / (entryPrice - invalidationPrice)).toFixed(2) : 0;

    signals.push({
      marketId: m.id,
      marketTitle: m.title,
      provider: m.platform,
      direction, score, confidence,
      entryZone: [+entryPrice.toFixed(4), +Math.min(0.95, entryPrice + 0.02).toFixed(4)],
      targetPrice: +targetPrice.toFixed(4),
      invalidationPrice: +invalidationPrice.toFixed(4),
      riskReward, setupType, thesis,
      netEdge: bestEdge,
    });
  }

  return signals.sort((a, b) => b.score - a.score).slice(0, 30);
}

// ─── MAIN HANDLER ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.user.id;

    // Load settings
    const { data: settings } = await supabase.from("auto_trade_settings").select("*").eq("user_id", userId).single();
    if (!settings?.enabled) {
      return new Response(JSON.stringify({ status: "disabled", reason: "Auto-trade is not enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (settings.kill_switch) {
      return new Response(JSON.stringify({ status: "killed", reason: "Kill switch is active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create engine run record
    const { data: run } = await supabase.from("engine_runs").insert({
      user_id: userId, status: "running", paper_mode: settings.paper_mode,
    }).select().single();
    const runId = run?.id;

    const updateRun = async (updates: Record<string, unknown>) => {
      if (!runId) return;
      await supabase.from("engine_runs").update({ ...updates, finished_at: new Date().toISOString() }).eq("id", runId);
    };

    // Check daily PnL / kill switch
    const today = new Date().toISOString().split("T")[0];
    const { data: dailyPnl } = await supabase.from("daily_pnl").select("*").eq("user_id", userId).eq("trade_date", today).single();
    if (dailyPnl?.kill_switch_triggered) {
      await updateRun({ status: "skipped", error_message: "Daily loss limit triggered" });
      return new Response(JSON.stringify({ status: "skipped", reason: "Daily loss limit" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (dailyPnl && dailyPnl.realized_pnl <= -settings.max_daily_loss) {
      await supabase.from("daily_pnl").update({ kill_switch_triggered: true }).eq("id", dailyPnl.id);
      await updateRun({ status: "killed", error_message: `Daily loss $${settings.max_daily_loss} reached` });
      return new Response(JSON.stringify({ status: "killed", reason: "Daily loss limit reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check open positions
    const { count: openPositions } = await supabase.from("positions").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "open");
    if ((openPositions ?? 0) >= settings.max_open_positions) {
      await updateRun({ status: "skipped", error_message: `Max positions (${settings.max_open_positions}) reached` });
      return new Response(JSON.stringify({ status: "skipped", reason: "Max positions reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FETCH LIVE MARKET DATA ──
    console.log("[ENGINE] Fetching market data from exchanges...");
    const allowedProviders = settings.allowed_providers as string[];
    const fetchPromises: Promise<RawMarket[]>[] = [];
    if (allowedProviders.includes("polymarket")) fetchPromises.push(fetchPolymarketMarkets());
    if (allowedProviders.includes("kalshi")) fetchPromises.push(fetchKalshiMarkets());

    const results = await Promise.allSettled(fetchPromises);
    const allMarkets: RawMarket[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") allMarkets.push(...r.value);
    }

    console.log(`[ENGINE] Fetched ${allMarkets.length} markets`);

    // ── GENERATE SIGNALS ──
    const allSignals = generateSignals(allMarkets);
    const qualifiedSignals = allSignals.filter(
      (s) => s.score >= settings.min_signal_score && s.confidence >= settings.min_confidence && allowedProviders.includes(s.provider)
    );

    console.log(`[ENGINE] ${allSignals.length} signals generated, ${qualifiedSignals.length} qualified`);

    if (qualifiedSignals.length === 0) {
      await updateRun({ status: "completed", signals_found: allSignals.length, trades_executed: 0, trades_skipped: allSignals.length });
      return new Response(JSON.stringify({
        status: "completed", signals: allSignals.length, qualified: 0, executed: 0,
        reason: "No signals met minimum score/confidence thresholds",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── EXECUTE TRADES ──
    const KALSHI_API_KEY_ID = Deno.env.get("KALSHI_API_KEY_ID");
    const KALSHI_PRIVATE_KEY = Deno.env.get("KALSHI_PRIVATE_KEY");
    const hasKalshiCreds = !!(KALSHI_API_KEY_ID && KALSHI_PRIVATE_KEY);

    const executed: Array<{ marketId: string; title: string; side: string; provider: string; mode: string; orderId?: string }> = [];
    let skipped = 0;

    for (const signal of qualifiedSignals) {
      if ((openPositions ?? 0) + executed.length >= settings.max_open_positions) { skipped++; continue; }

      // Check existing position
      const { count: existingPos } = await supabase.from("positions").select("*", { count: "exact", head: true })
        .eq("user_id", userId).eq("market_id", signal.marketId).eq("status", "open");
      if ((existingPos ?? 0) > 0) { skipped++; continue; }

      // Check cooldown
      const { data: lastOrder } = await supabase.from("order_history").select("created_at")
        .eq("user_id", userId).eq("market_id", signal.marketId).order("created_at", { ascending: false }).limit(1).single();
      if (lastOrder) {
        const elapsed = (Date.now() - new Date(lastOrder.created_at).getTime()) / 1000;
        if (elapsed < settings.cooldown_seconds) { skipped++; continue; }
      }

      const entryPrice = (signal.entryZone[0] + signal.entryZone[1]) / 2;
      const size = Math.min(settings.max_position_size, settings.max_position_size * (signal.confidence / 100));
      const contracts = Math.max(1, Math.floor(size / entryPrice));
      const side = signal.direction.toLowerCase() as "yes" | "no";

      let providerOrderId: string | null = null;
      let orderStatus = "filled";
      let errorMessage: string | null = null;
      let executedPrice = entryPrice;

      // LIVE KALSHI EXECUTION
      if (!settings.paper_mode && signal.provider === "kalshi" && hasKalshiCreds) {
        try {
          const kalshiOrder = { ticker: signal.marketId, action: "buy", side, type: "market", count: contracts };
          console.log(`[LIVE] Placing Kalshi order:`, JSON.stringify(kalshiOrder));
          const result = await kalshiRequest(KALSHI_API_KEY_ID!, KALSHI_PRIVATE_KEY!, "/portfolio/orders", "POST", kalshiOrder);
          providerOrderId = result.order?.order_id ?? result.order_id ?? null;
          orderStatus = result.order?.status === "resting" ? "pending" : "filled";
          executedPrice = result.order?.avg_price ? Number(result.order.avg_price) / 100 : entryPrice;
          console.log(`[LIVE] Order placed: ${providerOrderId}, status: ${orderStatus}`);
        } catch (err) {
          console.error(`[LIVE] Order failed:`, err);
          errorMessage = String(err);
          orderStatus = "failed";
        }
      } else if (!settings.paper_mode) {
        orderStatus = "failed";
        errorMessage = `Live execution not yet supported for ${signal.provider}`;
      }

      // Create position
      const { error: posError } = await supabase.from("positions").insert({
        user_id: userId, market_id: signal.marketId, market_title: signal.marketTitle,
        provider: signal.provider, side, entry_price: executedPrice, current_price: executedPrice,
        size, stop_price: signal.invalidationPrice, target_price: signal.targetPrice,
        signal_score: signal.score, confidence: signal.confidence, setup_type: signal.setupType,
        paper_mode: settings.paper_mode, status: orderStatus === "failed" ? "failed" : "open",
      });
      if (posError) { console.error("Position insert error:", posError); skipped++; continue; }

      // Create order record
      await supabase.from("order_history").insert({
        user_id: userId, market_id: signal.marketId, provider: signal.provider, side,
        order_type: "market", price: executedPrice, size, status: orderStatus,
        provider_order_id: providerOrderId, error_message: errorMessage,
        paper_mode: settings.paper_mode,
        executed_at: orderStatus === "filled" ? new Date().toISOString() : null,
      });

      // Update daily PnL
      if (dailyPnl) {
        await supabase.from("daily_pnl").update({ trade_count: dailyPnl.trade_count + executed.length + 1 }).eq("id", dailyPnl.id);
      } else {
        await supabase.from("daily_pnl").insert({ user_id: userId, trade_date: today, trade_count: 1 });
      }

      executed.push({
        marketId: signal.marketId, title: signal.marketTitle,
        side, provider: signal.provider,
        mode: settings.paper_mode ? "paper" : "live",
        orderId: providerOrderId ?? undefined,
      });
    }

    // Update engine run
    await updateRun({
      status: "completed",
      signals_found: allSignals.length,
      trades_executed: executed.length,
      trades_skipped: skipped,
      details: { trades: executed, qualified: qualifiedSignals.length },
    });

    console.log(`[ENGINE] Completed: ${executed.length} trades, ${skipped} skipped`);

    return new Response(JSON.stringify({
      status: "completed",
      signals: allSignals.length,
      qualified: qualifiedSignals.length,
      executed: executed.length,
      skipped,
      trades: executed,
      paperMode: settings.paper_mode,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[ENGINE] Fatal error:", err);
    return new Response(JSON.stringify({ status: "error", error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
