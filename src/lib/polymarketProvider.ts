import {
  TraderActivity,
  TraderDataProvider,
  TraderLeaderboardEntry,
  TraderPosition,
  TraderProfile,
} from "@/lib/trader-types";
import { supabase } from "@/integrations/supabase/client";

const safeNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const invokeProxy = async (action: string, params: Record<string, string> = {}) => {
  const search = new URLSearchParams({ action, ...params }).toString();
  const { data, error } = await supabase.functions.invoke("polymarket-proxy", {
    body: null,
    method: "GET",
    headers: {},
  });

  // supabase.functions.invoke doesn't support query params, so we use fetch directly
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) throw new Error("Not authenticated — sign in to view Smart Money data.");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/polymarket-proxy?${search}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Polymarket proxy error [${response.status}]: ${body}`);
  }

  return response.json();
};

const parseLeaderboardEntry = (item: any, rank: number): TraderLeaderboardEntry => {
  const realizedPnl = safeNumber(item.profit ?? item.pnl ?? item.realizedPnl);
  const volume = safeNumber(item.volume ?? item.totalVolume);
  const roiPct = realizedPnl != null && volume && volume > 0 ? (realizedPnl / volume) * 100 : undefined;

  return {
    traderId: item.proxyWallet ?? item.wallet ?? item.address ?? item.user ?? `unknown-${rank}`,
    username: item.name ?? item.username ?? item.handle ?? "Anonymous",
    walletAddress: item.proxyWallet ?? item.wallet ?? item.address,
    platform: "polymarket",
    realizedPnl,
    unrealizedPnl: safeNumber(item.unrealizedPnl),
    roiPct,
    winRatePct: safeNumber(item.winRate),
    totalMarketsTraded: safeNumber(item.totalMarkets) ?? safeNumber(item.marketsTraded),
    averagePositionSize: safeNumber(item.averagePositionSize),
    currentOpenPositionsCount: safeNumber(item.openPositions),
    rank,
    volume,
  };
};

const normalizePosition = (item: any): TraderPosition => ({
  marketId: String(item.conditionId ?? item.market ?? item.marketId ?? "unknown-market"),
  marketTitle: item.title ?? item.question ?? item.marketTitle ?? "Untitled market",
  marketUrl: item.slug ? `https://polymarket.com/event/${item.slug}` : item.marketSlug ? `https://polymarket.com/event/${item.marketSlug}` : undefined,
  outcome: item.outcome ?? "Unknown",
  side: String(item.outcome ?? "").toUpperCase() === "NO" ? "NO" : "YES",
  size: safeNumber(item.size ?? item.amount ?? item.position ?? item.shares) ?? 0,
  entryPrice: safeNumber(item.avgPrice ?? item.entryPrice ?? item.avgEntry),
  currentPrice: safeNumber(item.currentPrice ?? item.price),
  unrealizedPnl: safeNumber(item.unrealizedPnl ?? item.pnl),
  updatedAt: item.updatedAt ?? item.endDate ?? item.createdAt,
});

const normalizeActivity = (item: any, index: number): TraderActivity => ({
  id: String(item.id ?? `${item.type ?? "activity"}-${index}`),
  marketId: item.conditionId ?? item.market ?? item.marketId,
  marketTitle: item.title ?? item.question,
  marketUrl: item.slug ? `https://polymarket.com/event/${item.slug}` : undefined,
  action: item.type ?? item.side ?? "activity",
  side: String(item.side ?? item.outcome ?? "").toUpperCase() === "NO" ? "NO" : "YES",
  size: safeNumber(item.size ?? item.amount),
  price: safeNumber(item.price),
  createdAt: item.createdAt ?? item.timestamp ?? new Date().toISOString(),
});

export const polymarketProvider: TraderDataProvider = {
  async getTopTraders(limit = 25): Promise<TraderLeaderboardEntry[]> {
    const payload = await invokeProxy("top-traders", { limit: String(limit) });
    const rows = Array.isArray(payload) ? payload : payload?.leaders ?? payload?.data ?? [];
    return rows.map((item: any, index: number) => parseLeaderboardEntry(item, index + 1));
  },

  async getWorstTraders(limit = 25): Promise<TraderLeaderboardEntry[]> {
    const payload = await invokeProxy("worst-traders");
    const rows = Array.isArray(payload) ? payload : payload?.leaders ?? payload?.data ?? [];

    return rows
      .map((item: any, index: number) => parseLeaderboardEntry(item, index + 1))
      .filter((entry) => (entry.realizedPnl ?? 0) < 0)
      .sort((a, b) => (a.realizedPnl ?? 0) - (b.realizedPnl ?? 0))
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  },

  async getTraderProfile(traderId: string): Promise<TraderProfile> {
    const raw = await invokeProxy("profile", { address: traderId });

    const profile = raw?.profile ?? {};
    const positions = raw?.positions;
    const activity = raw?.activity;
    const value = raw?.value;
    const totalMarkets = raw?.totalMarkets;

    const openPositions = (Array.isArray(positions) ? positions : positions?.data ?? []).map(normalizePosition);
    const recentActivity = (Array.isArray(activity) ? activity : activity?.data ?? []).map(normalizeActivity);

    return {
      traderId,
      username: profile?.name ?? profile?.username ?? "Anonymous",
      walletAddress: profile?.wallet ?? traderId,
      platform: "polymarket",
      bio: profile?.bio,
      profileImage: profile?.profileImage,
      realizedPnl: safeNumber(profile?.profit),
      unrealizedPnl: safeNumber(value?.value ?? value?.unrealizedPnl),
      roiPct: safeNumber(profile?.roi),
      winRatePct: safeNumber(profile?.winRate),
      totalMarketsTraded: safeNumber(totalMarkets?.count ?? totalMarkets?.total),
      openPositions,
      recentActivity,
    };
  },
};
