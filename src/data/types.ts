export interface Market {
  id: string;
  ticker: string;
  title: string;
  platform: 'polymarket' | 'kalshi';
  marketSlug?: string;
  eventSlug?: string;
  seriesSlug?: string;
  category: 'sports' | 'politics' | 'economics' | 'weather' | 'culture' | 'crypto' | 'tech' | 'science' | 'entertainment' | 'finance' | 'health' | 'legal' | 'other';
  eventEnd: string;
  settlementRules: string;
  liquidityScore: number;
  market_url: string;
  volume24h: number;
  lastTradeTime: string;
  lastUpdated: string;
  yesPrice: number;
  noPrice: number;
  impliedProbYes: number;
  impliedProbNo: number;
  priceChange1h: number;
  priceChange24h: number;
}

export interface QuoteSnapshot {
  marketId: string;
  timestamp: string;
  bestYesBid: number;
  bestYesAsk: number;
  bestNoBid: number;
  bestNoAsk: number;
  spread: number;
}

export interface OrderBookLevel {
  marketId: string;
  side: 'yes' | 'no';
  price: number;
  size: number;
  level: number;
}

export interface TradePrint {
  marketId: string;
  timestamp: string;
  side: 'yes' | 'no';
  price: number;
  size: number;
}

export type SignalDirection = 'YES' | 'NO' | 'PASS';

export interface Signal {
  id: string;
  marketId: string;
  setupType: string;
  score: number;
  expectedNetEdge: number;
  confidence: number;
  action: 'paper_buy_yes' | 'paper_buy_no' | 'wait';
  direction: SignalDirection;
  rationale: string;
  thesis: string;
  momentum: number;
  imbalance: number;
  timeToExpiry: string;
  entryZone: [number, number];
  targetPrice: number;
  invalidationPrice: number;
  riskReward: number;
  catalystStrength: number;
  sentimentBias: 'bullish' | 'bearish' | 'neutral';
  smartMoneyFlag: boolean;
}

export interface JournalTrade {
  id: string;
  marketId: string;
  marketTitle: string;
  setupType: string;
  entryPrice: number;
  exitPrice: number | null;
  stopPrice: number;
  size: number;
  fees: number;
  slippage: number;
  realizedPnl: number | null;
  notes: string;
  mode: 'paper';
  timestamp: string;
  status: 'open' | 'closed' | 'stopped';
  category: string;
  side: SignalDirection;
  confidenceAtEntry: number;
  signalScoreAtEntry: number;
}

export interface BacktestRun {
  id: string;
  strategyName: string;
  dateRange: string;
  params: Record<string, number>;
  metrics: {
    totalTrades: number;
    winRate: number;
    avgWinner: number;
    avgLoser: number;
    netPnl: number;
    sharpe: number;
    maxDrawdown: number;
  };
}

export interface TradingProfile {
  dailyTarget: number;
  maxDailyLoss: number;
  perTradeRisk: number;
  feeModel: { maker: number; taker: number };
  slippageModel: number;
  paperBuyingPower: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  rules: string[];
  enabled: boolean;
  thresholds: Record<string, number>;
}

export type FreshnessStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'DISCONNECTED';

export const getFreshnessStatus = (lastUpdated: string | undefined, thresholdMs = 120_000): FreshnessStatus => {
  if (!lastUpdated) return 'DISCONNECTED';
  const age = Date.now() - new Date(lastUpdated).getTime();
  if (age < thresholdMs) return 'LIVE';
  if (age < thresholdMs * 5) return 'DELAYED';
  return 'STALE';
};

export const freshnessColors: Record<FreshnessStatus, string> = {
  LIVE: 'bg-profit/20 text-profit',
  DELAYED: 'bg-warning/20 text-warning',
  STALE: 'bg-loss/20 text-loss',
  DISCONNECTED: 'bg-muted text-muted-foreground',
};
