import { PlatformCapability } from "@/lib/trader-types";

export const capabilityMatrix: PlatformCapability[] = [
  {
    platform: "polymarket",
    leaderboardAvailability: "public",
    publicTraderProfiles: "public",
    publicPositions: "public",
    publicTradeHistory: "public",
    directMarketLinks: true,
    realTimeTrackability: "high",
    requiresAuthForCoreTracking: false,
    blockedNotes: "Most core tracker data is publicly documented via Gamma profile, positions, activity, and leaderboard endpoints.",
  },
  {
    platform: "kalshi",
    leaderboardAvailability: "public",
    publicTraderProfiles: "unavailable",
    publicPositions: "unavailable",
    publicTradeHistory: "unavailable",
    directMarketLinks: true,
    realTimeTrackability: "low",
    requiresAuthForCoreTracking: true,
    blockedNotes: "Kalshi leaderboard participation is opt-in and public APIs focus on markets/orderbook data, not broad public user-level position history.",
  },
];
