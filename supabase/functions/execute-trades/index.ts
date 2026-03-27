import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

interface Signal {
  marketId: string;
  marketTitle: string;
  provider: string;
  direction: "YES" | "NO" | "PASS";
  score: number;
  confidence: number;
  entryZone: [number, number];
  targetPrice: number;
  invalidationPrice: number;
  riskReward: number;
  setupType: string;
}

// --- Kalshi signing ---
async function signKalshi(
  apiKeyId: string,
  privateKeyPem: string,
  method: string,
  path: string,
  body: string = ""
): Promise<Record<string, string>> {
  const timestamp = String(Date.now());
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;

  // Import the private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    key,
    new TextEncoder().encode(payload)
  );

  return {
    "KALSHI-ACCESS-KEY": apiKeyId,
    "KALSHI-ACCESS-SIGNATURE": uint8ToBase64(new Uint8Array(sig)),
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "Content-Type": "application/json",
  };
}

async function kalshiRequest(
  apiKeyId: string,
  privateKey: string,
  path: string,
  method = "GET",
  body?: Record<string, unknown>
) {
  const bodyStr = body ? JSON.stringify(body) : "";
  const headers = await signKalshi(apiKeyId, privateKey, method, path, bodyStr);
  const res = await fetch(`${KALSHI_BASE}${path}`, {
    method,
    headers,
    body: bodyStr || undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Kalshi ${method} ${path} failed [${res.status}]: ${JSON.stringify(data)}`
    );
  }
  return data;
}

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const userId = claimsData.claims.sub as string;

    // Load settings
    const { data: settings } = await supabase
      .from("auto_trade_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!settings?.enabled) {
      return new Response(
        JSON.stringify({ executed: 0, reason: "Auto-trade disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (settings.kill_switch) {
      return new Response(
        JSON.stringify({ executed: 0, reason: "Kill switch active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily PnL
    const today = new Date().toISOString().split("T")[0];
    const { data: dailyPnl } = await supabase
      .from("daily_pnl")
      .select("*")
      .eq("user_id", userId)
      .eq("trade_date", today)
      .single();

    if (dailyPnl?.kill_switch_triggered) {
      return new Response(
        JSON.stringify({ executed: 0, reason: "Daily loss limit — kill switch triggered" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dailyPnl && dailyPnl.realized_pnl <= -settings.max_daily_loss) {
      await supabase
        .from("daily_pnl")
        .update({ kill_switch_triggered: true })
        .eq("id", dailyPnl.id);
      return new Response(
        JSON.stringify({ executed: 0, reason: `Daily loss limit ($${settings.max_daily_loss}) reached` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check open positions
    const { count: openPositions } = await supabase
      .from("positions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "open");

    if ((openPositions ?? 0) >= settings.max_open_positions) {
      return new Response(
        JSON.stringify({ executed: 0, reason: `Max positions (${settings.max_open_positions}) reached` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load credentials for live mode
    const KALSHI_API_KEY_ID = Deno.env.get("KALSHI_API_KEY_ID");
    const KALSHI_PRIVATE_KEY = Deno.env.get("KALSHI_PRIVATE_KEY");
    const hasKalshiCreds = !!(KALSHI_API_KEY_ID && KALSHI_PRIVATE_KEY);

    if (!settings.paper_mode && !hasKalshiCreds) {
      return new Response(
        JSON.stringify({ error: "Live mode requires API credentials. Add KALSHI_API_KEY_ID and KALSHI_PRIVATE_KEY secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse signals
    const body = await req.json();
    const signals: Signal[] = Array.isArray(body.signals) ? body.signals : [];

    const qualifiedSignals = signals.filter(
      (s) =>
        s.direction !== "PASS" &&
        s.score >= settings.min_signal_score &&
        s.confidence >= settings.min_confidence &&
        settings.allowed_providers.includes(s.provider)
    );

    const executed: Array<{ marketId: string; orderId?: string; mode: string }> = [];

    for (const signal of qualifiedSignals) {
      if ((openPositions ?? 0) + executed.length >= settings.max_open_positions) break;

      // Check existing position
      const { count: existingPos } = await supabase
        .from("positions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("market_id", signal.marketId)
        .eq("status", "open");

      if ((existingPos ?? 0) > 0) continue;

      // Check cooldown
      const { data: lastOrder } = await supabase
        .from("order_history")
        .select("created_at")
        .eq("user_id", userId)
        .eq("market_id", signal.marketId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastOrder) {
        const elapsed = (Date.now() - new Date(lastOrder.created_at).getTime()) / 1000;
        if (elapsed < settings.cooldown_seconds) continue;
      }

      const entryPrice = (signal.entryZone[0] + signal.entryZone[1]) / 2;
      const size = Math.min(
        settings.max_position_size,
        settings.max_position_size * (signal.confidence / 100)
      );

      // Convert dollar size to contract count (Kalshi contracts are $1 face value)
      const contracts = Math.max(1, Math.floor(size / entryPrice));
      const side = signal.direction.toLowerCase() as "yes" | "no";

      let providerOrderId: string | null = null;
      let orderStatus: string = "filled";
      let errorMessage: string | null = null;
      let executedPrice = entryPrice;

      // --- LIVE EXECUTION ---
      if (!settings.paper_mode && signal.provider === "kalshi" && hasKalshiCreds) {
        try {
          const kalshiOrder = {
            ticker: signal.marketId,
            action: "buy",
            side: side,
            type: "market",
            count: contracts,
          };

          console.log(`[LIVE] Placing Kalshi order:`, JSON.stringify(kalshiOrder));

          const result = await kalshiRequest(
            KALSHI_API_KEY_ID!,
            KALSHI_PRIVATE_KEY!,
            "/portfolio/orders",
            "POST",
            kalshiOrder
          );

          providerOrderId = result.order?.order_id ?? result.order_id ?? null;
          orderStatus = result.order?.status === "resting" ? "pending" : "filled";
          executedPrice = result.order?.avg_price
            ? Number(result.order.avg_price) / 100
            : entryPrice;

          console.log(`[LIVE] Order placed: ${providerOrderId}, status: ${orderStatus}`);
        } catch (err) {
          console.error(`[LIVE] Order failed:`, err);
          errorMessage = String(err);
          orderStatus = "failed";
        }
      } else if (!settings.paper_mode) {
        // Live mode but provider not supported yet
        orderStatus = "failed";
        errorMessage = `Live execution not yet supported for ${signal.provider}`;
      }

      // Create position record
      const { data: position, error: posError } = await supabase
        .from("positions")
        .insert({
          user_id: userId,
          market_id: signal.marketId,
          market_title: signal.marketTitle,
          provider: signal.provider,
          side,
          entry_price: executedPrice,
          current_price: executedPrice,
          size,
          stop_price: signal.invalidationPrice,
          target_price: signal.targetPrice,
          signal_score: signal.score,
          confidence: signal.confidence,
          setup_type: signal.setupType,
          paper_mode: settings.paper_mode,
          status: orderStatus === "failed" ? "failed" : "open",
        })
        .select()
        .single();

      if (posError) {
        console.error("Position insert error:", posError);
        continue;
      }

      // Create order record
      await supabase.from("order_history").insert({
        user_id: userId,
        position_id: position.id,
        market_id: signal.marketId,
        provider: signal.provider,
        side,
        order_type: "market",
        price: executedPrice,
        size,
        status: orderStatus,
        provider_order_id: providerOrderId,
        error_message: errorMessage,
        paper_mode: settings.paper_mode,
        executed_at: orderStatus === "filled" ? new Date().toISOString() : null,
      });

      // Update daily PnL
      if (dailyPnl) {
        await supabase
          .from("daily_pnl")
          .update({ trade_count: dailyPnl.trade_count + executed.length + 1 })
          .eq("id", dailyPnl.id);
      } else {
        await supabase.from("daily_pnl").insert({
          user_id: userId,
          trade_date: today,
          trade_count: 1,
        });
      }

      executed.push({
        marketId: signal.marketId,
        orderId: providerOrderId ?? undefined,
        mode: settings.paper_mode ? "paper" : "live",
      });
    }

    return new Response(
      JSON.stringify({
        executed: executed.length,
        trades: executed,
        paperMode: settings.paper_mode,
        openPositions: (openPositions ?? 0) + executed.filter(e => e.mode).length,
        maxPositions: settings.max_open_positions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Execute trades error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
