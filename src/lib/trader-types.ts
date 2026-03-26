export type SupportedPlatform = "polymarket" | "kalshi";

export interface PlatformCapability {
  platform: SupportedPlatform;
  leaderboardAvailability: "public" | "auth" | "unavailable";
  publicTraderProfiles: "public" | "auth" | "unavailable";
  publicPositions: "public" | "auth" | "unavailable";
  publicTradeHistory: "public" | "auth" | "unavailable";
  directMarketLinks: boolean;
  realTimeTrackability: "high" | "medium" | "low";
  requiresAuthForCoreTracking: boolean;
  blockedNotes: string;
}

export interface TraderLeaderboardEntry {
  traderId: string;
  username: string;
  walletAddress?: string;
  platform: SupportedPlatform;
  realizedPnl?: number;
  unrealizedPnl?: number;
  roiPct?: number;
  winRatePct?: number;
  totalMarketsTraded?: number;
  averagePositionSize?: number;
  currentOpenPositionsCount?: number;
  rank: number;
  volume?: number;
}

export interface TraderPosition {
  marketId: string;
  marketTitle: string;
  marketUrl?: string;
  outcome: string;
  side: "YES" | "NO";
  size: number;
  entryPrice?: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  updatedAt?: string;
}

export interface TraderActivity {
  id: string;
  marketId?: string;
  marketTitle?: string;
  marketUrl?: string;
  action: string;
  side?: "YES" | "NO";
  size?: number;
  price?: number;
  createdAt: string;
}

export interface TraderProfile {
  traderId: string;
  username: string;
  walletAddress: string;
  platform: SupportedPlatform;
  bio?: string;
  profileImage?: string;
  realizedPnl?: number;
  unrealizedPnl?: number;
  roiPct?: number;
  winRatePct?: number;
  totalMarketsTraded?: number;
  openPositions: TraderPosition[];
  recentActivity: TraderActivity[];
}

export interface TraderDataProvider {
  getTopTraders(limit?: number): Promise<TraderLeaderboardEntry[]>;
  getWorstTraders(limit?: number): Promise<TraderLeaderboardEntry[]>;
  getTraderProfile(traderId: string): Promise<TraderProfile>;
}
