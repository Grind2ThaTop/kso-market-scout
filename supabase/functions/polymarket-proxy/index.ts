import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATA_API = "https://data-api.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

async function dataGet(path: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams(params).toString();
  const suffix = `${path}${search ? `?${search}` : ""}`;
  const errors: string[] = [];

  // Try data-api first (v1 endpoints), then gamma as fallback
  for (const base of [DATA_API, GAMMA_API]) {
    const url = `${base}${suffix}`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        errors.push(`${url} -> ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err: any) {
      errors.push(`${url} -> ${err?.message ?? String(err)}`);
    }
  }
  throw new Error(`All Polymarket APIs failed for ${path}: ${errors.join(" | ")}`);
}

function buildClobHeaders(apiKey: string, apiSecret: string, apiPassphrase: string, method: string, path: string, body = "") {
  const timestamp = String(Math.floor(Date.now() / 1000));
  // HMAC-SHA256 signing for L2 auth
  const encoder = new TextEncoder();
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;

  // Use Web Crypto for HMAC
  return { timestamp, payload, apiKey, apiPassphrase };
}

async function clobGet(apiKey: string, apiSecret: string, apiPassphrase: string, path: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = `${timestamp}GET${path}`;

  // Import HMAC key
  const keyData = new TextEncoder().encode(apiSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  const res = await fetch(`${CLOB_API}${path}`, {
    headers: {
      "POLY_API_KEY": apiKey,
      "POLY_PASSPHRASE": apiPassphrase,
      "POLY_TIMESTAMP": timestamp,
      "POLY_SIGNATURE": signature,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CLOB ${path} [${res.status}]: ${body}`);
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    let result: unknown;

    switch (action) {
      case "top-traders": {
        const limit = Number(url.searchParams.get("limit") ?? 25);
        // Polymarket Data API v1 leaderboard endpoint
        result = await dataGet("/v1/leaderboard", { limit: String(Math.min(limit, 100)) });
        break;
      }
      case "worst-traders": {
        result = await dataGet("/v1/leaderboard", { limit: "200" });
        break;
      }
      case "profile": {
        const address = url.searchParams.get("address");
        if (!address) {
          return new Response(JSON.stringify({ error: "address required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const [profile, positions, activity, value, totalMarkets] = await Promise.allSettled([
          dataGet("/v1/profiles", { address }),
          dataGet("/v1/positions", { user: address, limit: "100" }),
          dataGet("/v1/activity", { user: address, limit: "100" }),
          dataGet("/v1/value", { user: address }),
          dataGet("/v1/traded-markets", { user: address }),
        ]);
        result = {
          profile: profile.status === "fulfilled" ? profile.value : null,
          positions: positions.status === "fulfilled" ? positions.value : [],
          activity: activity.status === "fulfilled" ? activity.value : [],
          value: value.status === "fulfilled" ? value.value : null,
          totalMarkets: totalMarkets.status === "fulfilled" ? totalMarkets.value : null,
        };
        break;
      }
      case "live-balance": {
        // Requires CLOB L2 credentials stored as secrets
        const polyApiKey = Deno.env.get("POLYMARKET_API_KEY");
        const polyApiSecret = Deno.env.get("POLYMARKET_API_SECRET");
        const polyPassphrase = Deno.env.get("POLYMARKET_PASSPHRASE");
        const polyWallet = Deno.env.get("POLYMARKET_WALLET_ADDRESS");

        if (!polyApiKey || !polyApiSecret || !polyPassphrase) {
          result = {
            balance: null,
            positions: [],
            error: "Polymarket CLOB credentials not configured. Add POLYMARKET_API_KEY, POLYMARKET_API_SECRET, and POLYMARKET_PASSPHRASE secrets.",
          };
          break;
        }

        const errors: string[] = [];
        let balance = null;
        let positions: unknown[] = [];
        let openOrders = 0;

        // Get balance from CLOB
        try {
          balance = await clobGet(polyApiKey, polyApiSecret, polyPassphrase, "/balance");
        } catch (e: any) {
          errors.push(`Balance: ${e.message}`);
        }

        // Get positions from public data API using wallet address
        if (polyWallet) {
          try {
            const posData = await dataGet("/v1/positions", { user: polyWallet, limit: "100" });
            positions = Array.isArray(posData) ? posData : posData?.data ?? posData?.positions ?? [];
          } catch (e: any) {
            errors.push(`Positions: ${e.message}`);
          }
        }

        // Get open orders from CLOB
        try {
          const ordersData = await clobGet(polyApiKey, polyApiSecret, polyPassphrase, "/orders?status=open");
          const ordersList = Array.isArray(ordersData) ? ordersData : ordersData?.data ?? [];
          openOrders = ordersList.length;
        } catch (e: any) {
          errors.push(`Orders: ${e.message}`);
        }

        result = {
          balance,
          positions,
          openOrders,
          errors: errors.length > 0 ? errors : undefined,
        };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid action. Use: top-traders, worst-traders, profile, live-balance" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Polymarket proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Proxy request failed", detail: String(err) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
