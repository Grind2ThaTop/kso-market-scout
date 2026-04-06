import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { constants, createSign } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

/** Normalize a PEM key that may have lost its line breaks or contains escaped \n */
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

function signKalshi(
  apiKeyId: string,
  privateKeyPem: string,
  method: string,
  path: string,
  body: string = ""
): Record<string, string> {
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

async function kalshiGet(apiKeyId: string, privateKey: string, path: string) {
  const headers = signKalshi(apiKeyId, privateKey, "GET", path);
  const res = await fetch(`${KALSHI_BASE}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kalshi GET ${path} [${res.status}]: ${body}`);
  }
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const userId = user.id;

    const KALSHI_API_KEY_ID = Deno.env.get("KALSHI_API_KEY_ID");
    const KALSHI_PRIVATE_KEY = Deno.env.get("KALSHI_PRIVATE_KEY");

    if (!KALSHI_API_KEY_ID || !KALSHI_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: "Kalshi credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Diagnostic logging (safe — only lengths & prefixes)
    console.log("Kalshi creds check:", {
      keyIdLen: KALSHI_API_KEY_ID.length,
      keyIdPrefix: KALSHI_API_KEY_ID.substring(0, 8),
      pemLen: KALSHI_PRIVATE_KEY.length,
      pemHasBegin: KALSHI_PRIVATE_KEY.includes("BEGIN"),
      pemLineCount: KALSHI_PRIVATE_KEY.split("\n").length,
    });

    // Fetch live data from Kalshi
    const [balanceRes, positionsRes, ordersRes] = await Promise.allSettled([
      kalshiGet(KALSHI_API_KEY_ID, KALSHI_PRIVATE_KEY, "/portfolio/balance"),
      kalshiGet(KALSHI_API_KEY_ID, KALSHI_PRIVATE_KEY, "/portfolio/positions?limit=100"),
      kalshiGet(KALSHI_API_KEY_ID, KALSHI_PRIVATE_KEY, "/portfolio/orders?status=open"),
    ]);

    if (balanceRes.status === "rejected") console.error("Balance fetch failed:", balanceRes.reason);
    if (positionsRes.status === "rejected") console.error("Positions fetch failed:", positionsRes.reason);
    if (ordersRes.status === "rejected") console.error("Orders fetch failed:", ordersRes.reason);

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
