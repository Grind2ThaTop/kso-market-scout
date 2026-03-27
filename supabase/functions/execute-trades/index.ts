import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Get user's auto-trade settings
    const { data: settings } = await supabase
      .from("auto_trade_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!settings || !settings.enabled) {
      return new Response(
        JSON.stringify({ executed: 0, reason: "Auto-trade disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check kill switch
    if (settings.kill_switch) {
      return new Response(
        JSON.stringify({ executed: 0, reason: "Kill switch active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily PnL limit
    const today = new Date().toISOString().split("T")[0];
    const { data: dailyPnl } = await supabase
      .from("daily_pnl")
      .select("*")
      .eq("user_id", userId)
      .eq("trade_date", today)
      .single();

    if (dailyPnl?.kill_switch_triggered) {
      return new Response(
        JSON.stringify({
          executed: 0,
          reason: "Daily loss limit hit — kill switch triggered",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      dailyPnl &&
      Math.abs(dailyPnl.realized_pnl) >= settings.max_daily_loss
    ) {
      // Trigger kill switch
      await supabase
        .from("daily_pnl")
        .update({ kill_switch_triggered: true })
        .eq("id", dailyPnl.id);

      return new Response(
        JSON.stringify({
          executed: 0,
          reason: `Daily loss limit ($${settings.max_daily_loss}) reached`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check open positions count
    const { count: openPositions } = await supabase
      .from("positions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "open");

    if ((openPositions ?? 0) >= settings.max_open_positions) {
      return new Response(
        JSON.stringify({
          executed: 0,
          reason: `Max open positions (${settings.max_open_positions}) reached`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse incoming signals
    const body = await req.json();
    const signals: Signal[] = Array.isArray(body.signals) ? body.signals : [];

    // Filter signals that meet thresholds
    const qualifiedSignals = signals.filter(
      (s) =>
        s.direction !== "PASS" &&
        s.score >= settings.min_signal_score &&
        s.confidence >= settings.min_confidence &&
        settings.allowed_providers.includes(s.provider)
    );

    const executed: string[] = [];

    for (const signal of qualifiedSignals) {
      if (
        (openPositions ?? 0) + executed.length >=
        settings.max_open_positions
      ) {
        break;
      }

      // Check if we already have a position in this market
      const { count: existingPos } = await supabase
        .from("positions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("market_id", signal.marketId)
        .eq("status", "open");

      if ((existingPos ?? 0) > 0) continue;

      // Check cooldown - last order in this market
      const { data: lastOrder } = await supabase
        .from("order_history")
        .select("created_at")
        .eq("user_id", userId)
        .eq("market_id", signal.marketId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastOrder) {
        const elapsed =
          (Date.now() - new Date(lastOrder.created_at).getTime()) / 1000;
        if (elapsed < settings.cooldown_seconds) continue;
      }

      const entryPrice =
        (signal.entryZone[0] + signal.entryZone[1]) / 2;
      const size = Math.min(
        settings.max_position_size,
        settings.max_position_size * (signal.confidence / 100)
      );

      // Create position
      const { data: position, error: posError } = await supabase
        .from("positions")
        .insert({
          user_id: userId,
          market_id: signal.marketId,
          market_title: signal.marketTitle,
          provider: signal.provider,
          side: signal.direction.toLowerCase() as "yes" | "no",
          entry_price: entryPrice,
          current_price: entryPrice,
          size,
          stop_price: signal.invalidationPrice,
          target_price: signal.targetPrice,
          signal_score: signal.score,
          confidence: signal.confidence,
          setup_type: signal.setupType,
          paper_mode: settings.paper_mode,
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
        side: signal.direction.toLowerCase() as "yes" | "no",
        order_type: "market",
        price: entryPrice,
        size,
        status: settings.paper_mode ? "filled" : "pending",
        paper_mode: settings.paper_mode,
        executed_at: settings.paper_mode ? new Date().toISOString() : null,
      });

      // Update daily PnL trade count
      if (dailyPnl) {
        await supabase
          .from("daily_pnl")
          .update({ trade_count: dailyPnl.trade_count + 1 })
          .eq("id", dailyPnl.id);
      } else {
        await supabase.from("daily_pnl").insert({
          user_id: userId,
          trade_date: today,
          trade_count: 1,
        });
      }

      executed.push(signal.marketId);
    }

    return new Response(
      JSON.stringify({
        executed: executed.length,
        markets: executed,
        paperMode: settings.paper_mode,
        openPositions: (openPositions ?? 0) + executed.length,
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
