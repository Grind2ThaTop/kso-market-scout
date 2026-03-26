export interface Market {
  id: string;
  ticker: string;
  title: string;
  category: 'sports' | 'politics' | 'economics' | 'weather' | 'culture';
  eventEnd: string;
  settlementRules: string;
  liquidityScore: number;
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

export interface Signal {
  id: string;
  marketId: string;
  setupType: string;
  score: number;
  expectedNetEdge: number;
  confidence: number;
  action: 'paper_buy_yes' | 'paper_buy_no' | 'wait';
  rationale: string;
  momentum: number;
  imbalance: number;
  timeToExpiry: string;
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
