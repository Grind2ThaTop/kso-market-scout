import { Market, QuoteSnapshot, Signal, JournalTrade, BacktestRun, Strategy } from './types';

const now = new Date();
const hours = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

const mkMarket = (
  id: string, ticker: string, title: string, platform: Market['platform'],
  category: Market['category'], hoursToEnd: number, liq: number,
  yesMid: number, slug = '',
): Market => {
  const yesPrice = +yesMid.toFixed(4);
  const noPrice = +(1 - yesMid).toFixed(4);
  return {
    id, ticker, title, platform, category,
    marketSlug: slug || id,
    eventSlug: '',
    eventEnd: hours(hoursToEnd),
    settlementRules: 'Resolves per official source.',
    liquidityScore: liq,
    market_url: platform === 'polymarket' ? `https://polymarket.com/event/${slug || id}` : `https://kalshi.com/markets/${slug || id}`,
    volume24h: Math.round(500 + Math.random() * 50000),
    lastTradeTime: hoursAgo(Math.random() * 2),
    lastUpdated: now.toISOString(),
    yesPrice,
    noPrice,
    impliedProbYes: +(yesPrice * 100).toFixed(1),
    impliedProbNo: +(noPrice * 100).toFixed(1),
    priceChange1h: +((Math.random() - 0.5) * 0.06).toFixed(4),
    priceChange24h: +((Math.random() - 0.5) * 0.12).toFixed(4),
  };
};

export const DEMO_MARKETS: Market[] = [
  mkMarket('pm-btc-100k', 'BTC100K', 'Bitcoin above $100k by end of month?', 'polymarket', 'economics', 72, 82, 0.62, 'bitcoin-100k'),
  mkMarket('pm-fed-rate', 'FEDRATE', 'Fed cuts rates at next meeting?', 'polymarket', 'economics', 168, 91, 0.38, 'fed-rate-cut'),
  mkMarket('pm-nba-lakers', 'NBALAL', 'Lakers win tonight?', 'polymarket', 'sports', 6, 70, 0.44, 'lakers-win-tonight'),
  mkMarket('pm-oscars-best', 'OSCARS', 'Who wins Best Picture 2026?', 'polymarket', 'culture', 480, 65, 0.28, 'oscars-best-picture'),
  mkMarket('pm-rain-nyc', 'RAINNYC', 'Rain in NYC tomorrow?', 'polymarket', 'weather', 18, 40, 0.72, 'rain-nyc-tomorrow'),
  mkMarket('kal-sp500-up', 'SP500UP', 'S&P 500 closes up today?', 'kalshi', 'economics', 8, 88, 0.56),
  mkMarket('kal-trump-tweet', 'TTWEET', 'Trump tweets before noon?', 'kalshi', 'politics', 4, 55, 0.81),
  mkMarket('kal-temp-90', 'TEMP90', 'Temperature exceeds 90°F in Phoenix today?', 'kalshi', 'weather', 10, 45, 0.67),
  mkMarket('kal-gdp-q2', 'GDPQ2', 'Q2 GDP growth above 2%?', 'kalshi', 'economics', 720, 78, 0.54),
  mkMarket('pm-eth-5k', 'ETH5K', 'Ethereum above $5k this month?', 'polymarket', 'economics', 120, 75, 0.21, 'eth-5k'),
  mkMarket('kal-house-bill', 'HBILL', 'House passes infrastructure bill this week?', 'kalshi', 'politics', 96, 62, 0.47),
  mkMarket('pm-nfl-draft', 'NFLDFT', 'First pick in NFL Draft is a QB?', 'polymarket', 'sports', 240, 73, 0.68, 'nfl-draft-qb'),
  mkMarket('kal-oil-80', 'OIL80', 'Oil above $80/barrel at close?', 'kalshi', 'economics', 9, 80, 0.59),
  mkMarket('pm-grammy-pop', 'GRMPOP', 'Taylor Swift wins Grammy for Pop?', 'polymarket', 'culture', 360, 58, 0.33, 'grammy-pop'),
  mkMarket('kal-snow-den', 'SNOWDN', 'Snow in Denver this weekend?', 'kalshi', 'weather', 48, 42, 0.41),
  mkMarket('pm-ufc-main', 'UFCMN', 'UFC main event winner by KO?', 'polymarket', 'sports', 30, 60, 0.35, 'ufc-ko'),
  mkMarket('kal-senate-vote', 'SENVOT', 'Senate confirms nominee this week?', 'kalshi', 'politics', 72, 68, 0.61),
  mkMarket('pm-gold-2k', 'GOLD2K', 'Gold above $2,000 end of week?', 'polymarket', 'economics', 48, 85, 0.73, 'gold-2k'),
  mkMarket('kal-hurricane', 'HURRIC', 'Named hurricane forms in Atlantic this month?', 'kalshi', 'weather', 336, 50, 0.18),
  mkMarket('pm-album-no1', 'ALBUM1', 'Drake album debuts at #1?', 'polymarket', 'culture', 168, 52, 0.52, 'drake-album'),
  mkMarket('kal-tsla-300', 'TSLA300', 'Tesla above $300 at close?', 'kalshi', 'economics', 8, 77, 0.48),
  mkMarket('pm-epl-ars', 'EPLARS', 'Arsenal wins Premier League match?', 'polymarket', 'sports', 20, 67, 0.57, 'arsenal-epl'),
  mkMarket('kal-cpi-3', 'CPI3', 'CPI comes in above 3%?', 'kalshi', 'economics', 192, 83, 0.31),
  mkMarket('pm-midterm', 'MIDTRM', 'Which party wins midterm Senate?', 'polymarket', 'politics', 1440, 90, 0.46, 'midterm-senate'),
  mkMarket('kal-wildfire', 'WFIRE', 'Wildfire evacuation order in CA this week?', 'kalshi', 'weather', 72, 35, 0.24),
];

const rng = (seed: number) => {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

const rand = rng(42);

export const DEMO_QUOTES: QuoteSnapshot[] = DEMO_MARKETS.map((m) => {
  const halfSpread = 0.005 + rand() * 0.025;
  const bid = Math.max(0.01, +(m.yesPrice - halfSpread).toFixed(4));
  const ask = Math.min(0.99, +(m.yesPrice + halfSpread).toFixed(4));
  return {
    marketId: m.id,
    timestamp: now.toISOString(),
    bestYesBid: bid,
    bestYesAsk: ask,
    bestNoBid: +(1 - ask).toFixed(4),
    bestNoAsk: +(1 - bid).toFixed(4),
    spread: +(ask - bid).toFixed(4),
  };
});

function buildDemoSignals(): Signal[] {
  return DEMO_QUOTES.map((q) => {
    const m = DEMO_MARKETS.find((mk) => mk.id === q.marketId)!;
    const mid = (q.bestYesBid + q.bestYesAsk) / 2;
    const momentum = Math.abs(0.5 - mid) * 2;
    const imbalance = Math.max(0, 1 - q.spread * 10);
    const edge = Math.max(0, 0.03 - q.spread / 2);
    const score = Math.round((momentum * 0.35 + imbalance * 0.35 + edge * 8 + (m.liquidityScore / 100) * 0.3) * 100);
    const confidence = Math.min(95, Math.max(20, Math.round((m.liquidityScore / 100) * 80 + momentum * 15)));
    const ms = new Date(m.eventEnd).getTime() - Date.now();
    const hrs = Math.round(ms / 3600_000);
    const tte = hrs < 0 ? 'Expired' : hrs < 1 ? `${Math.round(ms / 60000)}m` : hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;

    let direction: Signal['direction'] = 'PASS';
    let action: Signal['action'] = 'wait';
    let sentimentBias: Signal['sentimentBias'] = 'neutral';
    let thesis = 'No clear edge. Waiting for movement.';

    if (m.liquidityScore > 25 && q.spread < 0.08) {
      if (mid >= 0.58) {
        direction = 'YES'; action = 'paper_buy_yes'; sentimentBias = 'bullish';
        thesis = `YES favored at ${(mid * 100).toFixed(0)}¢. Spread ${(q.spread * 100).toFixed(1)}¢, liq ${m.liquidityScore}.`;
      } else if (mid <= 0.42) {
        direction = 'NO'; action = 'paper_buy_no'; sentimentBias = 'bearish';
        thesis = `NO favored (YES at ${(mid * 100).toFixed(0)}¢). Buy NO for value.`;
      } else if (mid >= 0.52) {
        direction = 'YES'; action = 'paper_buy_yes'; sentimentBias = 'bullish';
        thesis = `Slight YES lean at ${(mid * 100).toFixed(0)}¢. Liq: ${m.liquidityScore}.`;
      } else if (mid <= 0.48) {
        direction = 'NO'; action = 'paper_buy_no'; sentimentBias = 'bearish';
        thesis = `Slight NO lean (YES at ${(mid * 100).toFixed(0)}¢). Liq: ${m.liquidityScore}.`;
      }
    }

    const entryLow = direction === 'YES' ? q.bestYesAsk : direction === 'NO' ? q.bestNoAsk : mid;
    const entryHigh = entryLow + 0.02;
    const targetPrice = Math.min(0.95, entryLow + 0.08);
    const invalidationPrice = Math.max(0.05, entryLow - 0.06);
    const riskReward = entryLow - invalidationPrice > 0 ? +((targetPrice - entryLow) / (entryLow - invalidationPrice)).toFixed(2) : 0;

    return {
      id: `sig-${m.id}`, marketId: m.id,
      setupType: direction === 'PASS' ? 'No Setup' : momentum > 0.6 ? 'Momentum Entry' : 'Spread Capture',
      score, expectedNetEdge: +edge.toFixed(4), confidence, action, direction,
      rationale: `Spread ${(q.spread * 100).toFixed(1)}¢ | Liq ${m.liquidityScore} | Vol $${m.volume24h.toLocaleString()}`,
      thesis,
      momentum: +momentum.toFixed(3), imbalance: +imbalance.toFixed(3), timeToExpiry: tte,
      entryZone: [+entryLow.toFixed(4), +entryHigh.toFixed(4)] as [number, number],
      targetPrice: +targetPrice.toFixed(4),
      invalidationPrice: +invalidationPrice.toFixed(4),
      riskReward,
      catalystStrength: Math.round(30 + Math.random() * 50),
      sentimentBias,
      smartMoneyFlag: m.volume24h > 20000 && Math.random() > 0.6,
    };
  }).sort((a, b) => b.score - a.score);
}

export const DEMO_SIGNALS: Signal[] = buildDemoSignals();

export const DEMO_JOURNAL_TRADES: JournalTrade[] = [
  { id: 'jt-1', marketId: 'kal-sp500-up', marketTitle: 'S&P 500 closes up today?', setupType: 'Impulse Fade', entryPrice: 0.62, exitPrice: 0.71, stopPrice: 0.55, size: 30, fees: 0.90, slippage: 0.30, realizedPnl: 1.50, notes: 'Clean fade after morning spike.', mode: 'paper', timestamp: hoursAgo(2), status: 'closed', category: 'economics', side: 'YES', confidenceAtEntry: 78, signalScoreAtEntry: 82 },
  { id: 'jt-2', marketId: 'pm-btc-100k', marketTitle: 'Bitcoin above $100k by end of month?', setupType: 'Breakout Confirmation', entryPrice: 0.45, exitPrice: 0.53, stopPrice: 0.38, size: 20, fees: 0.60, slippage: 0.20, realizedPnl: 0.80, notes: 'Volume confirmed.', mode: 'paper', timestamp: hoursAgo(5), status: 'closed', category: 'economics', side: 'YES', confidenceAtEntry: 72, signalScoreAtEntry: 75 },
  { id: 'jt-3', marketId: 'pm-nba-lakers', marketTitle: 'Lakers win tonight?', setupType: 'Imbalance Reversion', entryPrice: 0.38, exitPrice: null, stopPrice: 0.30, size: 25, fees: 0.75, slippage: 0.25, realizedPnl: null, notes: 'Watching for reversion.', mode: 'paper', timestamp: hoursAgo(1), status: 'open', category: 'sports', side: 'NO', confidenceAtEntry: 63, signalScoreAtEntry: 68 },
  { id: 'jt-4', marketId: 'kal-trump-tweet', marketTitle: 'Trump tweets before noon?', setupType: 'Pre-Event Compression', entryPrice: 0.72, exitPrice: 0.65, stopPrice: 0.78, size: 15, fees: 0.45, slippage: 0.15, realizedPnl: -1.65, notes: 'Stopped out, wrong direction.', mode: 'paper', timestamp: hoursAgo(8), status: 'stopped', category: 'politics', side: 'YES', confidenceAtEntry: 55, signalScoreAtEntry: 61 },
  { id: 'jt-5', marketId: 'pm-fed-rate', marketTitle: 'Fed cuts rates at next meeting?', setupType: 'Settlement-Time Mispricing', entryPrice: 0.55, exitPrice: 0.63, stopPrice: 0.48, size: 40, fees: 1.20, slippage: 0.40, realizedPnl: 1.60, notes: 'Late mispricing capture.', mode: 'paper', timestamp: hoursAgo(12), status: 'closed', category: 'economics', side: 'NO', confidenceAtEntry: 81, signalScoreAtEntry: 85 },
];

export const DEMO_STRATEGIES: Strategy[] = [
  { id: 's1', name: 'Impulse Fade', description: 'Fade sharp moves that overshoot fair value.', rules: ['Price moves >5¢ in <10 min', 'Spread widens >2¢', 'Liquidity score >50'], enabled: true, thresholds: { momentum: 0.7, spread: 0.03, minLiquidity: 50 } },
  { id: 's2', name: 'Breakout With Confirmation', description: 'Buy breakouts confirmed by volume.', rules: ['Price breaks 1h high/low', 'Volume >150% of 1h avg', 'Spread <2¢'], enabled: true, thresholds: { volumeMultiple: 1.5, maxSpread: 0.02, minLiquidity: 60 } },
  { id: 's3', name: 'Imbalance Reversion', description: 'Trade reversion when order book is imbalanced.', rules: ['Bid/ask size ratio >3:1', 'Spread <3¢', 'Time to expiry >2h'], enabled: true, thresholds: { sizeRatio: 3, maxSpread: 0.03, minHoursToExpiry: 2 } },
  { id: 's4', name: 'Pre-Event Compression', description: 'Enter compressed ranges before catalyst.', rules: ['Spread narrows to <1.5¢', 'Event within 24h', 'Volatility declining'], enabled: false, thresholds: { maxSpread: 0.015, maxHoursToEvent: 24 } },
  { id: 's5', name: 'Settlement-Time Mispricing', description: 'Capture mispricing near settlement.', rules: ['Time to expiry <4h', 'Price deviates >3¢ from implied fair value', 'Liquidity score >40'], enabled: true, thresholds: { maxHoursToExpiry: 4, deviation: 0.03, minLiquidity: 40 } },
  { id: 's6', name: 'Overpriced YES Fade', description: 'Fade YES when probability exceeds fundamentals.', rules: ['YES price >75¢', 'No supporting catalyst in 24h', 'Smart money not confirming'], enabled: true, thresholds: { minYesPrice: 0.75, maxCatalyst: 30 } },
];

export const DEMO_BACKTESTS: BacktestRun[] = [
  { id: 'bt-1', strategyName: 'Impulse Fade', dateRange: '2026-02-01 to 2026-03-01', params: { momentum: 0.7, spread: 0.03 }, metrics: { totalTrades: 48, winRate: 0.625, avgWinner: 2.10, avgLoser: -1.40, netPnl: 32.40, sharpe: 1.8, maxDrawdown: 8.5 } },
  { id: 'bt-2', strategyName: 'Breakout With Confirmation', dateRange: '2026-02-01 to 2026-03-01', params: { volumeMultiple: 1.5, maxSpread: 0.02 }, metrics: { totalTrades: 35, winRate: 0.571, avgWinner: 3.20, avgLoser: -2.10, netPnl: 22.10, sharpe: 1.4, maxDrawdown: 12.0 } },
  { id: 'bt-3', strategyName: 'Imbalance Reversion', dateRange: '2026-02-01 to 2026-03-01', params: { sizeRatio: 3, maxSpread: 0.03 }, metrics: { totalTrades: 28, winRate: 0.643, avgWinner: 1.80, avgLoser: -1.50, netPnl: 15.60, sharpe: 1.6, maxDrawdown: 6.2 } },
  { id: 'bt-4', strategyName: 'Settlement-Time Mispricing', dateRange: '2026-02-01 to 2026-03-01', params: { maxHoursToExpiry: 4, deviation: 0.03 }, metrics: { totalTrades: 22, winRate: 0.682, avgWinner: 2.50, avgLoser: -1.80, netPnl: 19.80, sharpe: 2.1, maxDrawdown: 5.0 } },
];
