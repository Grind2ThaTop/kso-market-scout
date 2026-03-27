import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const POLYMARKET_APIS = [
  "https://data-api.polymarket.com",
  "https://gamma-api.polymarket.com",
];

async function proxyGet(path: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams(params).toString();
  const suffix = `${path}${search ? `?${search}` : ""}`;
  const errors: string[] = [];

  for (const base of POLYMARKET_APIS) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated user
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
        result = await proxyGet("/leaderboard", { limit: String(Math.min(limit, 100)) });
        break;
      }
      case "worst-traders": {
        result = await proxyGet("/leaderboard", { limit: "200" });
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
          proxyGet("/public-profile", { address }),
          proxyGet("/positions", { user: address, limit: "100" }),
          proxyGet("/activity", { user: address, limit: "100" }),
          proxyGet("/value", { user: address }),
          proxyGet("/traded-markets", { user: address }),
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
      default:
        return new Response(JSON.stringify({ error: "Invalid action. Use: top-traders, worst-traders, profile" }), {
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
