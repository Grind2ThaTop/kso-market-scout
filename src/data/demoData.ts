import { Market, QuoteSnapshot, Signal, JournalTrade, BacktestRun, TradingProfile, Strategy, OrderBookLevel, TradePrint } from './types';
import { buildMarketUrl } from '@/lib/marketUrlBuilder';

export const tradingProfile: TradingProfile = {
  dailyTarget: 500,
  maxDailyLoss: 200,
  perTradeRisk: 50,
  feeModel: { maker: 0.02, taker: 0.03 },
  slippageModel: 0.01,
  paperBuyingPower: 5000,
};

const rawMarkets: Omit<Market, 'market_url'>[] = [
  { id: 'm1', ticker: 'NBA-LAL-BOS', title: 'Lakers vs Celtics - Lakers Win', platform: 'polymarket', marketSlug: 'lakers-vs-celtics-lakers-win', category: 'sports', eventEnd: '2026-03-24T23:00:00Z', settlementRules: 'Settles YES if LAL wins', liquidityScore: 87 },
  { id: 'm2', ticker: 'PRES-APPROVAL', title: 'Presidential Approval > 50% by April', platform: 'kalshi', eventSlug: 'politics', marketSlug: 'presidential-approval-over-50-april', category: 'politics', eventEnd: '2026-04-01T00:00:00Z', settlementRules: 'Gallup poll avg', liquidityScore: 92 },
  { id: 'm3', ticker: 'FED-RATE-HOLD', title: 'Fed Holds Rate in April Meeting', platform: 'polymarket', marketSlug: 'fed-holds-rate-april', category: 'economics', eventEnd: '2026-04-15T18:00:00Z', settlementRules: 'FOMC statement', liquidityScore: 95 },
  { id: 'm4', ticker: 'HURR-ATLANTIC', title: 'Atlantic Hurricane Before May 1', platform: 'kalshi', eventSlug: 'weather', marketSlug: 'atlantic-hurricane-before-may', category: 'weather', eventEnd: '2026-05-01T00:00:00Z', settlementRules: 'NHC named storm', liquidityScore: 45 },
  { id: 'm5', ticker: 'OSCAR-BEST', title: 'Film X Wins Best Picture', platform: 'polymarket', marketSlug: 'film-x-wins-best-picture', category: 'culture', eventEnd: '2026-03-28T03:00:00Z', settlementRules: 'Academy announcement', liquidityScore: 78 },
  { id: 'm6', ticker: 'NFL-DRAFT-QB', title: 'QB Selected #1 Overall in Draft', platform: 'kalshi', eventSlug: 'sports', marketSlug: 'nfl-draft-qb-selected-first', category: 'sports', eventEnd: '2026-04-25T00:00:00Z', settlementRules: 'NFL draft pick', liquidityScore: 82 },
  { id: 'm7', ticker: 'CPI-ABOVE-3', title: 'March CPI Above 3.0%', platform: 'polymarket', marketSlug: 'march-cpi-above-3-percent', category: 'economics', eventEnd: '2026-04-10T12:30:00Z', settlementRules: 'BLS release', liquidityScore: 91 },
  { id: 'm8', ticker: 'MAYOR-NYC', title: 'NYC Mayor Approval Drops Below 30%', platform: 'kalshi', eventSlug: 'politics', marketSlug: 'nyc-mayor-approval-below-30', category: 'politics', eventEnd: '2026-04-15T00:00:00Z', settlementRules: 'Quinnipiac poll', liquidityScore: 58 },
  { id: 'm9', ticker: 'SNOW-NYC-APR', title: 'NYC Snow Accumulation in April', platform: 'polymarket', marketSlug: 'nyc-snow-accumulation-april', category: 'weather', eventEnd: '2026-04-30T00:00:00Z', settlementRules: 'NWS Central Park station', liquidityScore: 35 },
  { id: 'm10', ticker: 'GRAMMY-ALBUM', title: 'Artist Y Wins Album of Year', platform: 'kalshi', eventSlug: 'culture', marketSlug: 'artist-y-wins-album-of-year', category: 'culture', eventEnd: '2026-04-05T00:00:00Z', settlementRules: 'Grammy ceremony', liquidityScore: 72 },
  { id: 'm11', ticker: 'BTC-80K', title: 'Bitcoin Above $80K by April 1', platform: 'polymarket', marketSlug: 'bitcoin-above-80k-by-april-1', category: 'economics', eventEnd: '2026-04-01T00:00:00Z', settlementRules: 'CoinGecko avg', liquidityScore: 94 },
  { id: 'm12', ticker: 'UEFA-FINAL', title: 'Real Madrid Wins UCL Final', platform: 'kalshi', eventSlug: 'sports', marketSlug: 'real-madrid-wins-ucl-final', category: 'sports', eventEnd: '2026-05-30T00:00:00Z', settlementRules: 'UEFA result', liquidityScore: 88 },
  { id: 'm13', ticker: 'SENATE-VOTE', title: 'Senate Passes Infrastructure Bill', platform: 'polymarket', marketSlug: 'senate-passes-infrastructure-bill', category: 'politics', eventEnd: '2026-04-20T00:00:00Z', settlementRules: 'Senate roll call', liquidityScore: 65 },
  { id: 'm14', ticker: 'TEMP-RECORD', title: 'US Breaks March Temp Record', platform: 'kalshi', eventSlug: 'weather', marketSlug: 'us-breaks-march-temperature-record', category: 'weather', eventEnd: '2026-03-31T00:00:00Z', settlementRules: 'NOAA data', liquidityScore: 42 },
  { id: 'm15', ticker: 'STREAM-100M', title: 'New Series Hits 100M Views Week 1', platform: 'polymarket', marketSlug: 'new-series-hits-100m-views-week-1', category: 'culture', eventEnd: '2026-04-07T00:00:00Z', settlementRules: 'Netflix official report', liquidityScore: 68 },
  { id: 'm16', ticker: 'SPX-5500', title: 'S&P 500 Closes Above 5500 This Week', platform: 'kalshi', eventSlug: 'economics', marketSlug: 'spx-closes-above-5500-this-week', category: 'economics', eventEnd: '2026-03-28T20:00:00Z', settlementRules: 'NYSE close', liquidityScore: 96 },
  { id: 'm17', ticker: 'MLB-OPENER', title: 'Yankees Win Opening Day', platform: 'polymarket', marketSlug: 'yankees-win-opening-day', category: 'sports', eventEnd: '2026-03-27T00:00:00Z', settlementRules: 'MLB result', liquidityScore: 75 },
  { id: 'm18', ticker: 'GOV-SHUTDOWN', title: 'Government Shutdown Before May', platform: 'kalshi', eventSlug: 'politics', marketSlug: 'government-shutdown-before-may', category: 'politics', eventEnd: '2026-04-30T00:00:00Z', settlementRules: 'OMB designation', liquidityScore: 70 },
  { id: 'm19', ticker: 'TORNADO-APR', title: 'F3+ Tornado in April', platform: 'polymarket', marketSlug: 'f3-plus-tornado-in-april', category: 'weather', eventEnd: '2026-04-30T00:00:00Z', settlementRules: 'SPC reports', liquidityScore: 40 },
  { id: 'm20', ticker: 'GAME-SALES', title: 'New Game Sells 10M Copies Week 1', platform: 'kalshi', eventSlug: 'culture', marketSlug: 'new-game-sells-10m-week-1', category: 'culture', eventEnd: '2026-04-14T00:00:00Z', settlementRules: 'Publisher report', liquidityScore: 55 },
  { id: 'm21', ticker: 'GOLD-3K', title: 'Gold Futures Above $3000', platform: 'polymarket', marketSlug: 'gold-futures-above-3000', category: 'economics', eventEnd: '2026-04-01T00:00:00Z', settlementRules: 'COMEX settle', liquidityScore: 89 },
  { id: 'm22', ticker: 'NCAA-CHAMP', title: 'Duke Wins NCAA Tournament', platform: 'kalshi', eventSlug: 'sports', marketSlug: 'duke-wins-ncaa-tournament', category: 'sports', eventEnd: '2026-04-07T00:00:00Z', settlementRules: 'NCAA final', liquidityScore: 83 },
  { id: 'm23', ticker: 'TREATY-SIGN', title: 'Trade Treaty Signed by April', platform: 'polymarket', marketSlug: 'trade-treaty-signed-by-april', category: 'politics', eventEnd: '2026-04-30T00:00:00Z', settlementRules: 'State dept', liquidityScore: 38 },
  { id: 'm24', ticker: 'RAIN-LA', title: 'LA Gets >1 inch Rain This Week', platform: 'kalshi', eventSlug: 'weather', marketSlug: 'la-gets-over-one-inch-rain-this-week', category: 'weather', eventEnd: '2026-03-30T00:00:00Z', settlementRules: 'NWS LAX station', liquidityScore: 48 },
  { id: 'm25', ticker: 'BOOK-BEST', title: 'Novel Z Hits #1 NYT Bestseller', platform: 'polymarket', marketSlug: 'novel-z-hits-nyt-bestseller', category: 'culture', eventEnd: '2026-04-06T00:00:00Z', settlementRules: 'NYT list', liquidityScore: 52 },
];

export const markets: Market[] = rawMarkets.flatMap((market) => {
  const market_url = buildMarketUrl(market);
  if (!market_url) {
    console.warn(`[market-url] unable to build link for ${market.id} (${market.platform})`);
    return [];
  }

  return [{ ...market, market_url }];
});

const q = (mid: string, yb: number, ya: number): QuoteSnapshot => ({
  marketId: mid,
  timestamp: new Date().toISOString(),
  bestYesBid: yb,
  bestYesAsk: ya,
  bestNoBid: +(1 - ya).toFixed(2),
  bestNoAsk: +(1 - yb).toFixed(2),
  spread: +(ya - yb).toFixed(2),
});

export const quotes: QuoteSnapshot[] = [
  q('m1', 0.42, 0.45), q('m2', 0.38, 0.41), q('m3', 0.72, 0.74), q('m4', 0.08, 0.12),
  q('m5', 0.55, 0.58), q('m6', 0.61, 0.64), q('m7', 0.44, 0.47), q('m8', 0.33, 0.37),
  q('m9', 0.05, 0.09), q('m10', 0.29, 0.33), q('m11', 0.52, 0.54), q('m12', 0.35, 0.38),
  q('m13', 0.48, 0.51), q('m14', 0.15, 0.19), q('m15', 0.40, 0.44), q('m16', 0.66, 0.68),
  q('m17', 0.50, 0.53), q('m18', 0.22, 0.26), q('m19', 0.60, 0.63), q('m20', 0.18, 0.22),
  q('m21', 0.57, 0.59), q('m22', 0.25, 0.29), q('m23', 0.12, 0.16), q('m24', 0.30, 0.34),
  q('m25', 0.35, 0.39),
];

export const signals: Signal[] = [
  { id: 's1', marketId: 'm3', setupType: 'Impulse Fade', score: 92, expectedNetEdge: 0.06, confidence: 88, action: 'paper_buy_yes', rationale: 'Strong momentum with reversal signal at resistance. Spread tight, liquidity deep.', momentum: 0.85, imbalance: 0.72, timeToExpiry: '22d' },
  { id: 's2', marketId: 'm16', setupType: 'Breakout Confirmation', score: 89, expectedNetEdge: 0.05, confidence: 85, action: 'paper_buy_yes', rationale: 'Price broke above consolidation range with volume confirmation.', momentum: 0.91, imbalance: 0.65, timeToExpiry: '4d' },
  { id: 's3', marketId: 'm11', setupType: 'Imbalance Reversion', score: 85, expectedNetEdge: 0.04, confidence: 80, action: 'paper_buy_yes', rationale: 'Order book heavily imbalanced to buy side. Mean reversion expected.', momentum: 0.55, imbalance: 0.92, timeToExpiry: '8d' },
  { id: 's4', marketId: 'm1', setupType: 'Pre-Event Compression', score: 82, expectedNetEdge: 0.05, confidence: 78, action: 'paper_buy_yes', rationale: 'Volatility compressing before tip-off. Historical edge on late moves.', momentum: 0.68, imbalance: 0.58, timeToExpiry: '8h' },
  { id: 's5', marketId: 'm5', setupType: 'Settlement Mispricing', score: 80, expectedNetEdge: 0.04, confidence: 82, action: 'paper_buy_yes', rationale: 'Market underpricing consensus odds. Gap to settle value.', momentum: 0.45, imbalance: 0.50, timeToExpiry: '4d' },
  { id: 's6', marketId: 'm7', setupType: 'Impulse Fade', score: 78, expectedNetEdge: 0.03, confidence: 75, action: 'paper_buy_no', rationale: 'Overextended move up, reversion likely. Thin asks above.', momentum: 0.82, imbalance: 0.40, timeToExpiry: '17d' },
  { id: 's7', marketId: 'm21', setupType: 'Breakout Confirmation', score: 76, expectedNetEdge: 0.03, confidence: 72, action: 'paper_buy_yes', rationale: 'Gold correlation strong. Breakout confirmed on 4h chart.', momentum: 0.78, imbalance: 0.55, timeToExpiry: '8d' },
  { id: 's8', marketId: 'm2', setupType: 'Imbalance Reversion', score: 74, expectedNetEdge: 0.04, confidence: 70, action: 'paper_buy_no', rationale: 'Sell pressure building. Bid wall thinning.', momentum: 0.35, imbalance: 0.85, timeToExpiry: '8d' },
  { id: 's9', marketId: 'm6', setupType: 'Pre-Event Compression', score: 71, expectedNetEdge: 0.02, confidence: 68, action: 'wait', rationale: 'Compression phase starting but too early. Monitor.', momentum: 0.50, imbalance: 0.48, timeToExpiry: '32d' },
  { id: 's10', marketId: 'm13', setupType: 'Settlement Mispricing', score: 68, expectedNetEdge: 0.02, confidence: 65, action: 'wait', rationale: 'Slight mispricing but spread too wide for edge after costs.', momentum: 0.42, imbalance: 0.38, timeToExpiry: '27d' },
];

export const journalTrades: JournalTrade[] = [
  { id: 'jt1', marketId: 'm3', marketTitle: 'Fed Holds Rate in April', setupType: 'Impulse Fade', entryPrice: 0.70, exitPrice: 0.76, stopPrice: 0.66, size: 50, fees: 1.50, slippage: 0.50, realizedPnl: 148, notes: 'Clean entry on pullback. Exited at target.', mode: 'demo', timestamp: '2026-03-24T09:30:00Z', status: 'closed', category: 'economics' },
  { id: 'jt2', marketId: 'm16', marketTitle: 'S&P 500 Above 5500', setupType: 'Breakout Confirmation', entryPrice: 0.64, exitPrice: 0.69, stopPrice: 0.60, size: 40, fees: 1.20, slippage: 0.40, realizedPnl: 98.40, notes: 'Breakout held. Took partial at +3c.', mode: 'demo', timestamp: '2026-03-24T10:15:00Z', status: 'closed', category: 'economics' },
  { id: 'jt3', marketId: 'm1', marketTitle: 'Lakers vs Celtics', setupType: 'Pre-Event Compression', entryPrice: 0.44, exitPrice: null, stopPrice: 0.38, size: 30, fees: 0.90, slippage: 0.30, realizedPnl: null, notes: 'Entered compression. Waiting for event catalyst.', mode: 'demo', timestamp: '2026-03-24T11:00:00Z', status: 'open', category: 'sports' },
  { id: 'jt4', marketId: 'm11', marketTitle: 'Bitcoin Above $80K', setupType: 'Imbalance Reversion', entryPrice: 0.53, exitPrice: 0.50, stopPrice: 0.49, size: 25, fees: 0.75, slippage: 0.25, realizedPnl: -76, notes: 'Stopped out. Imbalance resolved faster than expected.', mode: 'demo', timestamp: '2026-03-24T08:45:00Z', status: 'stopped', category: 'economics' },
  { id: 'jt5', marketId: 'm5', marketTitle: 'Film X Best Picture', setupType: 'Settlement Mispricing', entryPrice: 0.56, exitPrice: 0.60, stopPrice: 0.52, size: 35, fees: 1.05, slippage: 0.35, realizedPnl: 72.60, notes: 'Mispricing closed as expected. Clean trade.', mode: 'demo', timestamp: '2026-03-23T14:30:00Z', status: 'closed', category: 'culture' },
  { id: 'jt6', marketId: 'm7', marketTitle: 'March CPI Above 3%', setupType: 'Impulse Fade', entryPrice: 0.46, exitPrice: 0.42, stopPrice: 0.50, size: 45, fees: 1.35, slippage: 0.45, realizedPnl: 88.20, notes: 'Faded impulse on NO side. Worked perfectly.', mode: 'demo', timestamp: '2026-03-23T11:00:00Z', status: 'closed', category: 'economics' },
];

export const backtestRuns: BacktestRun[] = [
  { id: 'bt1', strategyName: 'Impulse Fade', dateRange: '2026-01-01 to 2026-03-24', params: { momentumThreshold: 0.75, imbalanceMin: 0.6, minLiquidity: 70 }, metrics: { totalTrades: 142, winRate: 0.63, avgWinner: 4.2, avgLoser: -3.1, netPnl: 1842, sharpe: 1.85, maxDrawdown: 312 } },
  { id: 'bt2', strategyName: 'Breakout Confirmation', dateRange: '2026-01-01 to 2026-03-24', params: { breakoutPeriod: 12, volumeMultiple: 1.5, minSpread: 0.02 }, metrics: { totalTrades: 98, winRate: 0.58, avgWinner: 5.1, avgLoser: -3.8, netPnl: 1245, sharpe: 1.52, maxDrawdown: 428 } },
  { id: 'bt3', strategyName: 'Imbalance Reversion', dateRange: '2026-01-01 to 2026-03-24', params: { imbalanceThreshold: 0.8, reversionTarget: 0.5, maxHold: 60 }, metrics: { totalTrades: 115, winRate: 0.55, avgWinner: 3.8, avgLoser: -2.9, netPnl: 956, sharpe: 1.28, maxDrawdown: 385 } },
  { id: 'bt4', strategyName: 'Pre-Event Compression', dateRange: '2026-01-01 to 2026-03-24', params: { compressionWindow: 24, volThreshold: 0.15, entryOffset: 0.02 }, metrics: { totalTrades: 67, winRate: 0.67, avgWinner: 6.2, avgLoser: -4.5, netPnl: 1568, sharpe: 1.95, maxDrawdown: 267 } },
  { id: 'bt5', strategyName: 'Settlement Mispricing', dateRange: '2026-01-01 to 2026-03-24', params: { mispricingGap: 0.05, minConfidence: 70, maxTimeToSettle: 72 }, metrics: { totalTrades: 54, winRate: 0.72, avgWinner: 4.8, avgLoser: -5.2, netPnl: 1124, sharpe: 1.72, maxDrawdown: 198 } },
];

export const strategies: Strategy[] = [
  { id: 'str1', name: 'Impulse Fade', description: 'Fade sharp price moves when momentum indicators show exhaustion, order book imbalance shifts, and price reaches technical levels.', rules: ['Momentum > 0.75 on 5min timeframe', 'Imbalance reversal signal detected', 'Spread < 4 cents', 'Liquidity score > 70', 'Enter at first candle reversal', 'Stop: 4 cents beyond impulse high/low'], enabled: true, thresholds: { momentum: 0.75, imbalance: 0.6, minLiquidity: 70, maxSpread: 0.04 }, sampleMetrics: backtestRuns[0].metrics },
  { id: 'str2', name: 'Breakout With Confirmation', description: 'Enter when price breaks consolidation range with volume confirmation and follow-through.', rules: ['12-period consolidation range identified', 'Volume > 1.5x average on break', 'Spread < 3 cents at entry', 'Follow-through candle confirms direction', 'Target: 1.5x range width', 'Stop: Opposite side of range'], enabled: true, thresholds: { breakoutPeriod: 12, volumeMultiple: 1.5, minSpread: 0.02, rangeMultiple: 1.5 }, sampleMetrics: backtestRuns[1].metrics },
  { id: 'str3', name: 'Imbalance Reversion', description: 'Trade mean reversion when order book imbalance reaches extreme levels and begins normalizing.', rules: ['Imbalance ratio > 0.80', 'Reversion toward 0.50 begins', 'Max hold time 60 minutes', 'Liquidity score > 60', 'Entry on first neutral candle', 'Stop: Imbalance extends +10%'], enabled: true, thresholds: { imbalanceThreshold: 0.80, reversionTarget: 0.50, maxHoldMins: 60, minLiquidity: 60 }, sampleMetrics: backtestRuns[2].metrics },
  { id: 'str4', name: 'Pre-Event Compression', description: 'Capture volatility expansion after pre-event compression squeezes resolve. Enter during quiet period, exit on event catalyst.', rules: ['Volatility < 15% of 30-day avg', '24h compression window', 'Entry 2 cents from mid', 'Event catalyst within 48h', 'Target: Post-event move to 65th percentile', 'Stop: 6 cents from entry'], enabled: true, thresholds: { compressionWindow: 24, volThreshold: 0.15, entryOffset: 0.02, maxTimeToEvent: 48 }, sampleMetrics: backtestRuns[3].metrics },
  { id: 'str5', name: 'Settlement-Time Mispricing', description: 'Identify contracts mispriced relative to settlement probability within final hours before expiry.', rules: ['Mispricing gap > 5 cents vs model', 'Confidence > 70%', 'Time to settle < 72 hours', 'Liquidity sufficient for exit', 'Enter at market ask', 'Hold to settlement or exit at 80% target'], enabled: false, thresholds: { mispricingGap: 0.05, minConfidence: 70, maxTimeToSettle: 72, exitTargetPct: 0.80 }, sampleMetrics: backtestRuns[4].metrics },
];

export function generateOrderBook(marketId: string): OrderBookLevel[] {
  const quote = quotes.find(q => q.marketId === marketId);
  if (!quote) return [];
  const levels: OrderBookLevel[] = [];
  for (let i = 0; i < 5; i++) {
    levels.push({ marketId, side: 'yes', price: +(quote.bestYesBid - i * 0.01).toFixed(2), size: Math.floor(Math.random() * 500) + 100, level: i });
    levels.push({ marketId, side: 'no', price: +(quote.bestNoAsk + i * 0.01).toFixed(2), size: Math.floor(Math.random() * 500) + 100, level: i });
  }
  return levels;
}

export function generatePriceHistory(marketId: string): { time: string; price: number }[] {
  const quote = quotes.find(q => q.marketId === marketId);
  const base = quote ? quote.bestYesBid : 0.50;
  const points: { time: string; price: number }[] = [];
  let p = base - 0.10 + Math.random() * 0.05;
  for (let i = 0; i < 48; i++) {
    p += (Math.random() - 0.48) * 0.02;
    p = Math.max(0.02, Math.min(0.98, p));
    const h = new Date();
    h.setHours(h.getHours() - (48 - i));
    points.push({ time: h.toISOString(), price: +p.toFixed(3) });
  }
  return points;
}

export function generateTradePrints(marketId: string): TradePrint[] {
  const quote = quotes.find(q => q.marketId === marketId);
  const base = quote ? (quote.bestYesBid + quote.bestYesAsk) / 2 : 0.50;
  const prints: TradePrint[] = [];
  for (let i = 0; i < 20; i++) {
    const t = new Date();
    t.setMinutes(t.getMinutes() - i * 3);
    prints.push({
      marketId,
      timestamp: t.toISOString(),
      side: Math.random() > 0.5 ? 'yes' : 'no',
      price: +(base + (Math.random() - 0.5) * 0.04).toFixed(2),
      size: Math.floor(Math.random() * 200) + 10,
    });
  }
  return prints;
}
