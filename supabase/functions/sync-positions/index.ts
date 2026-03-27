import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

async function signKalshi(
  apiKeyId: string,
  privateKeyPem: string,
  method: string,
  path: string,
  body: string = ""
): Promise<Record<string, string>> {
  const timestamp = String(Date.now());
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
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
    "KALSHI-ACCESS-SIGNATURE": base64Encode(new Uint8Array(sig)),
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "Content-Type": "application/json",
  };
}

async function kalshiGet(apiKeyId: string, privateKey: string, path: string) {
  const headers = await signKalshi(apiKeyId, privateKey, "GET", path);
  const res = await fetch(`${KALSHI_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`Kalshi GET ${path} [${res.status}]`);
  return res.json();
}

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

    const KALSHI_API_KEY_ID = Deno.env.get("KALSHI_API_KEY_ID");
    const KALSHI_PRIVATE_KEY = Deno.env.get("KALSHI_PRIVATE_KEY");

    if (!KALSHI_API_KEY_ID || !KALSHI_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: "Kalshi credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch live data from Kalshi
    const [balanceRes, positionsRes, ordersRes] = await Promise.allSettled([
      kalshiGet(KALSHI_API_KEY_ID, KALSHI_PRIVATE_KEY, "/portfolio/balance"),
      kalshiGet(KALSHI_API_KEY_ID, KALSHI_PRIVATE_KEY, "/portfolio/positions?limit=100"),
      kalshiGet(KALSHI_API_KEY_ID, KALSHI_PRIVATE_KEY, "/portfolio/orders?status=open"),
    ]);

    const balance = balanceRes.status === "fulfilled" ? balanceRes.value : null;
    const livePositions = positionsRes.status === "fulfilled" ? positionsRes.value : null;
    const liveOrders = ordersRes.status === "fulfilled" ? ordersRes.value : null;

    // Sync positions to database
    const kalshiPositions = Array.isArray(livePositions?.market_positions)
      ? livePositions.market_positions
      : [];

    let synced = 0;

    for (const pos of kalshiPositions) {
      const ticker = pos.ticker ?? pos.market_ticker;
      const quantity = Number(pos.position ?? pos.total_traded ?? 0);
      if (!ticker || quantity === 0) continue;

      // Check if we already track this position
      const { data: existing } = await supabase
        .from("positions")
        .select("id")
        .eq("user_id", userId)
        .eq("market_id", ticker)
        .eq("status", "open")
        .eq("paper_mode", false)
        .single();

      if (!existing) {
        // Create tracked position from exchange data
        const avgPrice = Number(pos.average_price ?? pos.market_average_price ?? 50) / 100;
        await supabase.from("positions").insert({
          user_id: userId,
          market_id: ticker,
          market_title: pos.title ?? ticker,
          provider: "kalshi",
          side: (pos.side ?? "yes").toLowerCase() === "no" ? "no" : "yes",
          entry_price: avgPrice,
          current_price: avgPrice,
          size: quantity,
          paper_mode: false,
          status: "open",
        });
        synced++;
      } else {
        // Update current price
        const currentPrice = Number(pos.market_price ?? pos.average_price ?? 50) / 100;
        const pnl = (currentPrice - Number(pos.average_price ?? 50) / 100) * quantity;
        await supabase
          .from("positions")
          .update({ current_price: currentPrice, pnl })
          .eq("id", existing.id);
        synced++;
      }
    }

    // Close positions that are no longer on exchange
    const { data: trackedPositions } = await supabase
      .from("positions")
      .select("id, market_id")
      .eq("user_id", userId)
      .eq("status", "open")
      .eq("paper_mode", false)
      .eq("provider", "kalshi");

    const liveTickerSet = new Set(
      kalshiPositions.map((p: Record<string, unknown>) => p.ticker ?? p.market_ticker)
    );

    for (const tp of trackedPositions ?? []) {
      if (!liveTickerSet.has(tp.market_id)) {
        await supabase
          .from("positions")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", tp.id);
      }
    }

    return new Response(
      JSON.stringify({
        balance: balance
          ? {
              available: balance.available_balance_cents
                ? balance.available_balance_cents / 100
                : balance.balance
                  ? Number(balance.balance) / 100
                  : null,
              total: balance.total_balance_cents
                ? balance.total_balance_cents / 100
                : null,
            }
          : null,
        livePositions: kalshiPositions.length,
        liveOrders: Array.isArray(liveOrders?.orders)
          ? liveOrders.orders.length
          : 0,
        synced,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(
      JSON.stringify({ error: "Sync failed", detail: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
