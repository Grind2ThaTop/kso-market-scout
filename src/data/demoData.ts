import { Market, QuoteSnapshot, Signal, JournalTrade, BacktestRun, Strategy } from './types';

const now = new Date();
const hours = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();

const mkMarket = (
  id: string, ticker: string, title: string, platform: Market['platform'],
  category: Market['category'], hoursToEnd: number, liq: number, slug = '',
): Market => ({
  id, ticker, title, platform, category,
  marketSlug: slug || id,
  eventSlug: '',
  eventEnd: hours(hoursToEnd),
  settlementRules: 'Resolves per official source.',
  liquidityScore: liq,
  market_url: platform === 'polymarket' ? `https://polymarket.com/event/${slug || id}` : `https://kalshi.com/markets/${slug || id}`,
});

export const DEMO_MARKETS: Market[] = [
  mkMarket('pm-btc-100k', 'BTC100K', 'Bitcoin above $100k by end of month?', 'polymarket', 'economics', 72, 82, 'bitcoin-100k'),
  mkMarket('pm-fed-rate', 'FEDRATE', 'Fed cuts rates at next meeting?', 'polymarket', 'economics', 168, 91, 'fed-rate-cut'),
  mkMarket('pm-nba-lakers', 'NBALAL', 'Lakers win tonight?', 'polymarket', 'sports', 6, 70, 'lakers-win-tonight'),
  mkMarket('pm-oscars-best', 'OSCARS', 'Who wins Best Picture 2026?', 'polymarket', 'culture', 480, 65, 'oscars-best-picture'),
  mkMarket('pm-rain-nyc', 'RAINNYC', 'Rain in NYC tomorrow?', 'polymarket', 'weather', 18, 40, 'rain-nyc-tomorrow'),
  mkMarket('kal-sp500-up', 'SP500UP', 'S&P 500 closes up today?', 'kalshi', 'economics', 8, 88),
  mkMarket('kal-trump-tweet', 'TTWEET', 'Trump tweets before noon?', 'kalshi', 'politics', 4, 55),
  mkMarket('kal-temp-90', 'TEMP90', 'Temperature exceeds 90°F in Phoenix today?', 'kalshi', 'weather', 10, 45),
  mkMarket('kal-gdp-q2', 'GDPQ2', 'Q2 GDP growth above 2%?', 'kalshi', 'economics', 720, 78),
  mkMarket('pm-eth-5k', 'ETH5K', 'Ethereum above $5k this month?', 'polymarket', 'economics', 120, 75, 'eth-5k'),
  mkMarket('kal-house-bill', 'HBILL', 'House passes infrastructure bill this week?', 'kalshi', 'politics', 96, 62),
  mkMarket('pm-nfl-draft', 'NFLDFT', 'First pick in NFL Draft is a QB?', 'polymarket', 'sports', 240, 73, 'nfl-draft-qb'),
  mkMarket('kal-oil-80', 'OIL80', 'Oil above $80/barrel at close?', 'kalshi', 'economics', 9, 80),
  mkMarket('pm-grammy-pop', 'GRMPOP', 'Taylor Swift wins Grammy for Pop?', 'polymarket', 'culture', 360, 58, 'grammy-pop'),
  mkMarket('kal-snow-den', 'SNOWDN', 'Snow in Denver this weekend?', 'kalshi', 'weather', 48, 42),
  mkMarket('pm-ufc-main', 'UFCMN', 'UFC main event winner by KO?', 'polymarket', 'sports', 30, 60, 'ufc-ko'),
  mkMarket('kal-senate-vote', 'SENVOT', 'Senate confirms nominee this week?', 'kalshi', 'politics', 72, 68),
  mkMarket('pm-gold-2k', 'GOLD2K', 'Gold above $2,000 end of week?', 'polymarket', 'economics', 48, 85, 'gold-2k'),
  mkMarket('kal-hurricane', 'HURRIC', 'Named hurricane forms in Atlantic this month?', 'kalshi', 'weather', 336, 50),
  mkMarket('pm-album-no1', 'ALBUM1', 'Drake album debuts at #1?', 'polymarket', 'culture', 168, 52, 'drake-album'),
  mkMarket('kal-tsla-300', 'TSLA300', 'Tesla above $300 at close?', 'kalshi', 'economics', 8, 77),
  mkMarket('pm-epl-ars', 'EPLARS', 'Arsenal wins Premier League match?', 'polymarket', 'sports', 20, 67, 'arsenal-epl'),
  mkMarket('kal-cpi-3', 'CPI3', 'CPI comes in above 3%?', 'kalshi', 'economics', 192, 83),
  mkMarket('pm-midterm', 'MIDTRM', 'Which party wins midterm Senate?', 'polymarket', 'politics', 1440, 90, 'midterm-senate'),
  mkMarket('kal-wildfire', 'WFIRE', 'Wildfire evacuation order in CA this week?', 'kalshi', 'weather', 72, 35),
];

const rng = (seed: number) => {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

const rand = rng(42);

export const DEMO_QUOTES: QuoteSnapshot[] = DEMO_MARKETS.map((m) => {
  const mid = 0.2 + rand() * 0.6;
  const halfSpread = 0.005 + rand() * 0.03;
  const bid = Math.max(0.01, +(mid - halfSpread).toFixed(4));
  const ask = Math.min(0.99, +(mid + halfSpread).toFixed(4));
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
    const momentum = Math.abs(0.5 - q.bestYesBid) * 2;
    const imbalance = 1 - q.spread * 20;
    const edge = Math.max(0, 0.02 - q.spread / 2);
    const score = Math.round((momentum * 0.4 + Math.max(0, imbalance) * 0.4 + edge * 10) * 100);
    const confidence = Math.min(95, Math.max(30, Math.round((m.liquidityScore / 100) * 90)));
    const ms = new Date(m.eventEnd).getTime() - Date.now();
    const hrs = Math.round(ms / 3600_000);
    const tte = hrs < 0 ? 'Expired' : hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
    const action: Signal['action'] = edge > 0.01 ? (q.bestYesBid >= 0.5 ? 'paper_buy_yes' : 'paper_buy_no') : 'wait';
    return {
      id: `sig-${m.id}`, marketId: m.id, setupType: 'Spread Scanner', score,
      expectedNetEdge: +edge.toFixed(4), confidence, action,
      rationale: `Spread ${(q.spread * 100).toFixed(1)}¢ | Liquidity ${m.liquidityScore}`,
      momentum: +momentum.toFixed(3), imbalance: +Math.max(0, imbalance).toFixed(3), timeToExpiry: tte,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 40);
}

export const DEMO_SIGNALS: Signal[] = buildDemoSignals();

export const DEMO_JOURNAL_TRADES: JournalTrade[] = [
  { id: 'jt-1', marketId: 'kal-sp500-up', marketTitle: 'S&P 500 closes up today?', setupType: 'Impulse Fade', entryPrice: 0.62, exitPrice: 0.71, stopPrice: 0.55, size: 30, fees: 0.90, slippage: 0.30, realizedPnl: 1.50, notes: 'Clean fade after morning spike.', mode: 'paper', timestamp: hours(-2), status: 'closed', category: 'economics' },
  { id: 'jt-2', marketId: 'pm-btc-100k', marketTitle: 'Bitcoin above $100k by end of month?', setupType: 'Breakout Confirmation', entryPrice: 0.45, exitPrice: 0.53, stopPrice: 0.38, size: 20, fees: 0.60, slippage: 0.20, realizedPnl: 0.80, notes: 'Volume confirmed.', mode: 'paper', timestamp: hours(-5), status: 'closed', category: 'economics' },
  { id: 'jt-3', marketId: 'pm-nba-lakers', marketTitle: 'Lakers win tonight?', setupType: 'Imbalance Reversion', entryPrice: 0.38, exitPrice: null, stopPrice: 0.30, size: 25, fees: 0.75, slippage: 0.25, realizedPnl: null, notes: 'Watching for reversion.', mode: 'paper', timestamp: hours(-1), status: 'open', category: 'sports' },
  { id: 'jt-4', marketId: 'kal-trump-tweet', marketTitle: 'Trump tweets before noon?', setupType: 'Pre-Event Compression', entryPrice: 0.72, exitPrice: 0.65, stopPrice: 0.78, size: 15, fees: 0.45, slippage: 0.15, realizedPnl: -1.65, notes: 'Stopped out, wrong direction.', mode: 'paper', timestamp: hours(-8), status: 'stopped', category: 'politics' },
  { id: 'jt-5', marketId: 'pm-fed-rate', marketTitle: 'Fed cuts rates at next meeting?', setupType: 'Settlement-Time Mispricing', entryPrice: 0.55, exitPrice: 0.63, stopPrice: 0.48, size: 40, fees: 1.20, slippage: 0.40, realizedPnl: 1.60, notes: 'Late mispricing capture.', mode: 'paper', timestamp: hours(-12), status: 'closed', category: 'economics' },
];

export const DEMO_STRATEGIES: Strategy[] = [
  { id: 's1', name: 'Impulse Fade', description: 'Fade sharp moves that overshoot fair value.', rules: ['Price moves >5¢ in <10 min', 'Spread widens >2¢', 'Liquidity score >50'], enabled: true, thresholds: { momentum: 0.7, spread: 0.03, minLiquidity: 50 } },
  { id: 's2', name: 'Breakout With Confirmation', description: 'Buy breakouts confirmed by volume.', rules: ['Price breaks 1h high/low', 'Volume >150% of 1h avg', 'Spread <2¢'], enabled: true, thresholds: { volumeMultiple: 1.5, maxSpread: 0.02, minLiquidity: 60 } },
  { id: 's3', name: 'Imbalance Reversion', description: 'Trade reversion when order book is imbalanced.', rules: ['Bid/ask size ratio >3:1', 'Spread <3¢', 'Time to expiry >2h'], enabled: true, thresholds: { sizeRatio: 3, maxSpread: 0.03, minHoursToExpiry: 2 } },
  { id: 's4', name: 'Pre-Event Compression', description: 'Enter compressed ranges before catalyst.', rules: ['Spread narrows to <1.5¢', 'Event within 24h', 'Volatility declining'], enabled: false, thresholds: { maxSpread: 0.015, maxHoursToEvent: 24 } },
  { id: 's5', name: 'Settlement-Time Mispricing', description: 'Capture mispricing near settlement.', rules: ['Time to expiry <4h', 'Price deviates >3¢ from implied fair value', 'Liquidity score >40'], enabled: true, thresholds: { maxHoursToExpiry: 4, deviation: 0.03, minLiquidity: 40 } },
];

export const DEMO_BACKTESTS: BacktestRun[] = [
  { id: 'bt-1', strategyName: 'Impulse Fade', dateRange: '2026-02-01 to 2026-03-01', params: { momentum: 0.7, spread: 0.03 }, metrics: { totalTrades: 48, winRate: 0.625, avgWinner: 2.10, avgLoser: -1.40, netPnl: 32.40, sharpe: 1.8, maxDrawdown: 8.5 } },
  { id: 'bt-2', strategyName: 'Breakout With Confirmation', dateRange: '2026-02-01 to 2026-03-01', params: { volumeMultiple: 1.5, maxSpread: 0.02 }, metrics: { totalTrades: 35, winRate: 0.571, avgWinner: 3.20, avgLoser: -2.10, netPnl: 22.10, sharpe: 1.4, maxDrawdown: 12.0 } },
  { id: 'bt-3', strategyName: 'Imbalance Reversion', dateRange: '2026-02-01 to 2026-03-01', params: { sizeRatio: 3, maxSpread: 0.03 }, metrics: { totalTrades: 28, winRate: 0.643, avgWinner: 1.80, avgLoser: -1.50, netPnl: 15.60, sharpe: 1.6, maxDrawdown: 6.2 } },
  { id: 'bt-4', strategyName: 'Settlement-Time Mispricing', dateRange: '2026-02-01 to 2026-03-01', params: { maxHoursToExpiry: 4, deviation: 0.03 }, metrics: { totalTrades: 22, winRate: 0.682, avgWinner: 2.50, avgLoser: -1.80, netPnl: 19.80, sharpe: 2.1, maxDrawdown: 5.0 } },
];
