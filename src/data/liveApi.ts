import { Market, QuoteSnapshot, Signal, SignalDirection, TradingProfile } from './types';
import { buildMarketUrl } from '@/lib/marketUrlBuilder';

const DEFAULT_POLL_MS = 15000;

const clamp01 = (value: number) => Math.max(0.01, Math.min(0.99, value));
const normalizePrice = (value: number): number => {
  if (value > 1 && value <= 100) return value / 100;
  if (value > 100 && value <= 10000) return value / 10000;
  return value;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
    const markets = (payload as Record<string, unknown>).markets;
    if (Array.isArray(markets)) return markets;
  }
  return [];
};

const normalizeCategory = (value: unknown): Market['category'] => {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('sport') || raw.includes('nba') || raw.includes('nfl') || raw.includes('ufc') || raw.includes('mlb') || raw.includes('nhl') || raw.includes('soccer') || raw.includes('tennis') || raw.includes('golf') || raw.includes('f1') || raw.includes('boxing') || raw.includes('mma') || raw.includes('ncaa') || raw.includes('fifa') || raw.includes('olympics')) return 'sports';
  if (raw.includes('polit') || raw.includes('elect') || raw.includes('senate') || raw.includes('congress') || raw.includes('president') || raw.includes('governor') || raw.includes('democrat') || raw.includes('republican') || raw.includes('vote') || raw.includes('geopolit') || raw.includes('war') || raw.includes('nato') || raw.includes('government')) return 'politics';
  if (raw.includes('weath') || raw.includes('temp') || raw.includes('rain') || raw.includes('snow') || raw.includes('hurricane') || raw.includes('tornado') || raw.includes('climate') || raw.includes('wildfire') || raw.includes('earthquake')) return 'weather';
  if (raw.includes('cult') || raw.includes('entertain') || raw.includes('movie') || raw.includes('music') || raw.includes('oscar') || raw.includes('grammy') || raw.includes('celebrity') || raw.includes('tv') || raw.includes('social media') || raw.includes('tiktok') || raw.includes('youtube') || raw.includes('awards')) return 'entertainment';
  if (raw.includes('crypto') || raw.includes('bitcoin') || raw.includes('ethereum') || raw.includes('btc') || raw.includes('eth') || raw.includes('token') || raw.includes('defi') || raw.includes('nft') || raw.includes('web3') || raw.includes('blockchain') || raw.includes('solana')) return 'crypto';
  if (raw.includes('tech') || raw.includes('ai') || raw.includes('artificial') || raw.includes('apple') || raw.includes('google') || raw.includes('microsoft') || raw.includes('openai') || raw.includes('spacex') || raw.includes('tesla') || raw.includes('meta') || raw.includes('nvidia') || raw.includes('semiconductor') || raw.includes('software')) return 'tech';
  if (raw.includes('science') || raw.includes('space') || raw.includes('nasa') || raw.includes('physics') || raw.includes('biology') || raw.includes('research')) return 'science';
  if (raw.includes('financ') || raw.includes('stock') || raw.includes('market') || raw.includes('fed') || raw.includes('interest rate') || raw.includes('gdp') || raw.includes('inflation') || raw.includes('recession') || raw.includes('s&p') || raw.includes('nasdaq') || raw.includes('dow') || raw.includes('treasury') || raw.includes('bond') || raw.includes('forex') || raw.includes('commodity') || raw.includes('oil') || raw.includes('gold')) return 'finance';
  if (raw.includes('econ') || raw.includes('cpi') || raw.includes('employment') || raw.includes('jobs') || raw.includes('wage') || raw.includes('trade') || raw.includes('tariff') || raw.includes('housing')) return 'economics';
  if (raw.includes('health') || raw.includes('covid') || raw.includes('fda') || raw.includes('pharma') || raw.includes('vaccine') || raw.includes('disease') || raw.includes('medical') || raw.includes('drug') || raw.includes('pandemic')) return 'health';
  if (raw.includes('legal') || raw.includes('court') || raw.includes('supreme') || raw.includes('lawsuit') || raw.includes('trial') || raw.includes('verdict') || raw.includes('regulation') || raw.includes('law')) return 'legal';
  return 'other';
};

const inferQuote = (row: Record<string, unknown>) => {
  const rawBid =
    toNumber(row.bestYesBid) ??
    toNumber(row.bestBid) ??
    toNumber(row.yesBid) ??
    toNumber(row.yes_bid) ??
    toNumber(row.yes_bid_dollars) ??
    toNumber(row.bid) ??
    toNumber(row.lastTradePrice) ??
    toNumber(row.last_price) ??
    toNumber(row.last_price_dollars) ??
    toNumber(row.final_last_traded_price);
  const rawAsk =
    toNumber(row.bestYesAsk) ??
    toNumber(row.bestAsk) ??
    toNumber(row.yesAsk) ??
    toNumber(row.yes_ask) ??
    toNumber(row.yes_ask_dollars) ??
    toNumber(row.ask) ??
    rawBid;

  if (rawBid == null || rawAsk == null) return null;

  const bid = normalizePrice(rawBid);
  const ask = normalizePrice(rawAsk);
  const noBid = toNumber(row.bestNoBid) ?? toNumber(row.noBid) ?? toNumber(row.no_bid) ?? toNumber(row.no_bid_dollars);
  const noAsk = toNumber(row.bestNoAsk) ?? toNumber(row.noAsk) ?? toNumber(row.no_ask) ?? toNumber(row.no_ask_dollars);

  const normalizedNoBid = noBid == null ? null : normalizePrice(noBid);
  const normalizedNoAsk = noAsk == null ? null : normalizePrice(noAsk);

  const resolvedBid = normalizedNoAsk != null ? Math.max(0.01, 1 - normalizedNoAsk) : bid;
  const resolvedAsk = normalizedNoBid != null ? Math.min(0.99, 1 - normalizedNoBid) : ask;

  const bestYesBid = clamp01(Math.min(resolvedBid, resolvedAsk));
  const bestYesAsk = clamp01(Math.max(resolvedBid, resolvedAsk));
  return { bestYesBid, bestYesAsk };
};

export interface ScanSnapshot {
  fetchedAt: string;
  source: 'live-api' | 'live-edge' | 'integrations-api' | 'demo';
  markets: Market[];
  quotes: QuoteSnapshot[];
  signals: Signal[];
  droppedCount: number;
  providerStatus: Record<string, 'connected' | 'error' | 'empty'>;
}

export interface ScannerConfig {
  apiUrl?: string;
  apiKey?: string;
  integrationsApiBase?: string;
  pollIntervalMs: number;
  profile: TradingProfile;
}

export const scannerConfig: ScannerConfig = {
  apiUrl: import.meta.env.VITE_MARKET_DATA_URL,
  apiKey: import.meta.env.VITE_MARKET_DATA_API_KEY,
  integrationsApiBase: import.meta.env.VITE_INTEGRATIONS_API_BASE,
  pollIntervalMs: Number(import.meta.env.VITE_MARKET_DATA_POLL_MS ?? DEFAULT_POLL_MS),
  profile: {
    dailyTarget: Number(import.meta.env.VITE_DAILY_TARGET_USD ?? 500),
    maxDailyLoss: Number(import.meta.env.VITE_MAX_DAILY_LOSS_USD ?? 200),
    perTradeRisk: Number(import.meta.env.VITE_PER_TRADE_RISK_USD ?? 50),
    feeModel: {
      maker: Number(import.meta.env.VITE_MAKER_FEE_PER_CONTRACT ?? 0.02),
      taker: Number(import.meta.env.VITE_TAKER_FEE_PER_CONTRACT ?? 0.03),
    },
    slippageModel: Number(import.meta.env.VITE_SLIPPAGE_PER_CONTRACT ?? 0.01),
    paperBuyingPower: Number(import.meta.env.VITE_PAPER_BUYING_POWER_USD ?? 5000),
  },
};

export class MissingDataSourceError extends Error {
  constructor() {
    super('No market data source is available. Set VITE_MARKET_DATA_URL or run integrations API.');
  }
}

const resolveIntegrationsBase = () => scannerConfig.integrationsApiBase?.trim() || '';

const fetchIntegrationProviderMarkets = async (provider: 'kalshi' | 'polymarket'): Promise<{ provider: string; rows: unknown[]; status: 'connected' | 'error' | 'empty' }> => {
  try {
    const base = resolveIntegrationsBase();
    const url = `${base}/api/prediction-markets/markets?provider=${provider}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return { provider, rows: [], status: 'error' };
    const data = await response.json();
    const rows = parseArray(data);
    return { provider, rows, status: rows.length > 0 ? 'connected' : 'empty' };
  } catch {
    return { provider, rows: [], status: 'error' };
  }
};

const fetchIntegrationMarketsBestEffort = async (): Promise<{ rows: unknown[]; providerStatus: Record<string, 'connected' | 'error' | 'empty'> }> => {
  const results = await Promise.allSettled([
    fetchIntegrationProviderMarkets('kalshi'),
    fetchIntegrationProviderMarkets('polymarket'),
  ]);

  const mergedRows: unknown[] = [];
  const providerStatus: Record<string, 'connected' | 'error' | 'empty'> = {};

  for (const result of results) {
    if (result.status === 'fulfilled') {
      mergedRows.push(...result.value.rows);
      providerStatus[result.value.provider] = result.value.status;
    } else {
      providerStatus['unknown'] = 'error';
    }
  }

  return { rows: mergedRows, providerStatus };
};

const pickFirstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const pickFirstNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
};

const extractSourceRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const raw = row.raw;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : row;
};

const resolveMarketUrl = (
  row: Record<string, unknown>,
  sourceRow: Record<string, unknown>,
  platform: Market['platform'],
  marketSlug: string,
  eventSlug: string,
): string => {
  const directUrl = pickFirstString(
    row.market_url, row.marketUrl, row.url, row.permalink, row.link,
    sourceRow.market_url, sourceRow.marketUrl, sourceRow.url, sourceRow.permalink, sourceRow.link,
  );
  if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) return directUrl;

  if (platform === 'polymarket') {
    const polySlug = pickFirstString(row.eventSlug, sourceRow.eventSlug, row.slug, sourceRow.slug, row.conditionSlug, sourceRow.conditionSlug);
    if (polySlug) return `https://polymarket.com/event/${polySlug}`;
  }

  return buildMarketUrl({ platform, marketSlug, eventSlug }) || '';
};

/** Check if a market is closed, resolved, expired, or otherwise not tradable */
const isMarketDead = (row: Record<string, unknown>, sourceRow: Record<string, unknown>): boolean => {
  // Check explicit closed flag
  const closed = row.closed ?? sourceRow.closed;
  if (closed === true || String(closed).toLowerCase() === 'true') return true;

  // Check closedTime (if set and in the past)
  const closedTime = pickFirstString(row.closedTime, sourceRow.closedTime, row.closed_time, sourceRow.closed_time);
  if (closedTime) {
    const ct = new Date(closedTime).getTime();
    if (Number.isFinite(ct) && ct < Date.now()) return true;
  }

  // Check status field for resolved/settled/etc
  const status = pickFirstString(row.status, sourceRow.status).toLowerCase();
  if (/(closed|resolved|settled|final|expired|inactive|cancelled)/.test(status)) return true;

  // Check active flag
  const activeFlag = row.active ?? sourceRow.active;
  if (activeFlag === false || String(activeFlag).toLowerCase() === 'false') return true;

  // Check end date
  const eventEnd = pickFirstString(
    row.eventEnd, row.endDate, row.end_date, row.closeTime, row.close_time, row.expiration, row.expiration_time,
    sourceRow.eventEnd, sourceRow.endDate, sourceRow.end_date, sourceRow.closeTime, sourceRow.close_time, sourceRow.expiration, sourceRow.expiration_time,
  );
  if (eventEnd) {
    const endMs = new Date(eventEnd).getTime();
    if (Number.isFinite(endMs) && endMs <= Date.now()) return true;
  }

  // Check if resolution value is set (market already resolved)
  const result = pickFirstString(row.result, sourceRow.result, row.resolution, sourceRow.resolution);
  if (result && result !== '' && result !== 'pending' && result !== 'active') return true;

  return false;
};

/** Check if a market has zero liquidity / zero volume - ghost market */
const isGhostMarket = (row: Record<string, unknown>, sourceRow: Record<string, unknown>): boolean => {
  const liqNum = pickFirstNumber(row.liquidityNum, sourceRow.liquidityNum, row.liquidity, sourceRow.liquidity);
  const volNum = pickFirstNumber(row.volumeNum, sourceRow.volumeNum, row.volume, sourceRow.volume);
  const vol24h = pickFirstNumber(row.volume24hr, sourceRow.volume24hr, row.volume_24h, sourceRow.volume_24h, row.volume24h, sourceRow.volume24h);

  // If explicit liquidity and volume are both 0, it's a ghost
  if (liqNum === 0 && volNum !== null && volNum < 100) return true;
  // If all volume metrics are 0
  if (vol24h === 0 && (volNum === 0 || volNum === null) && (liqNum === 0 || liqNum === null)) return true;

  return false;
};

/** Filter out junk titles (mega-parlays, unreadable titles) */
const isJunkTitle = (title: string): boolean => {
  // Multi-leg parlays with extremely long titles
  if (title.length > 200) return true;
  // Titles that are just comma-separated player stats
  if ((title.match(/,/g) || []).length > 5) return true;
  return false;
};

const normalizeRows = (rows: unknown[], fetchedAt: string) => {
  let droppedCount = 0;
  const seenIds = new Set<string>();

  const normalized = rows
    .map((item): { market: Market; quote: QuoteSnapshot } | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const sourceRow = extractSourceRow(row);

      const id = pickFirstString(row.id, row.marketId, row.conditionId, row.ticker, row.slug, sourceRow.id, sourceRow.ticker, sourceRow.conditionId);
      const title = pickFirstString(row.title, row.question, row.name, sourceRow.title, sourceRow.question, sourceRow.name);
      if (!id || !title) { droppedCount++; return null; }

      // Dedup
      if (seenIds.has(id)) { droppedCount++; return null; }
      seenIds.add(id);

      // Filter dead markets
      if (isMarketDead(row, sourceRow)) { droppedCount++; return null; }

      // Filter ghost markets
      if (isGhostMarket(row, sourceRow)) { droppedCount++; return null; }

      // Filter junk titles
      if (isJunkTitle(title)) { droppedCount++; return null; }

      const quote = inferQuote({ ...sourceRow, ...row });
      if (!quote) { droppedCount++; return null; }

      // Filter markets with no real price data (both bid and ask at 0 or 1)
      if (quote.bestYesBid <= 0.01 && quote.bestYesAsk <= 0.01) { droppedCount++; return null; }
      if (quote.bestYesBid >= 0.99 && quote.bestYesAsk >= 0.99) { droppedCount++; return null; }

      // Filter near-resolved markets — no profit room above 90¢ or below 10¢
      const midPrice = (quote.bestYesBid + quote.bestYesAsk) / 2;
      if (midPrice >= 0.90 || midPrice <= 0.10) { droppedCount++; return null; }

      const eventEnd = pickFirstString(
        row.eventEnd, row.endDate, row.end_date, row.closeTime, row.close_time, row.expiration, row.expiration_time,
        sourceRow.eventEnd, sourceRow.endDate, sourceRow.end_date, sourceRow.closeTime, sourceRow.close_time, sourceRow.expiration, sourceRow.expiration_time,
      );

      const volume24h = pickFirstNumber(
        row.volume24hr, sourceRow.volume24hr, row.volume_24h, sourceRow.volume_24h,
        row.volume24h, sourceRow.volume24h, row.volume, sourceRow.volume,
        row.volumeNum, sourceRow.volumeNum,
      ) ?? 0;
      const totalVol = pickFirstNumber(
        row.volumeNum, sourceRow.volumeNum, row.volume, sourceRow.volume,
      ) ?? 0;
      const liquidityRaw = pickFirstNumber(
        row.liquidityNum, sourceRow.liquidityNum, row.liquidity, sourceRow.liquidity,
        row.liquidity_dollars, sourceRow.liquidity_dollars,
      ) ?? 0;
      const liquidityScore = Math.max(1, Math.min(99, Math.round(Math.log10(Math.max(totalVol, liquidityRaw) + 10) * 30)));

      const lastUpdated = pickFirstString(
        row.updatedAt, row.updated_time, row.lastUpdated, sourceRow.updatedAt, sourceRow.updated_time, sourceRow.lastUpdated,
        fetchedAt,
      );
      const lastTradeTime = pickFirstString(
        row.lastTradeTime, sourceRow.lastTradeTime, row.updated_time, sourceRow.updated_time, lastUpdated,
      );

      const platform = (pickFirstString(row.platform, row.provider, sourceRow.platform, sourceRow.provider, 'polymarket').toLowerCase() as Market['platform']) || 'polymarket';
      const marketSlug = pickFirstString(
        row.marketSlug, row.slug, row.conditionSlug, row.ticker,
        sourceRow.marketSlug, sourceRow.slug, sourceRow.conditionSlug, sourceRow.ticker,
      );
      const eventSlug = pickFirstString(
        row.eventSlug, row.event, row.event_ticker, row.series_ticker,
        sourceRow.eventSlug, sourceRow.event, sourceRow.event_ticker, sourceRow.series_ticker,
      );

      const yesPrice = (quote.bestYesBid + quote.bestYesAsk) / 2;
      const noPrice = 1 - yesPrice;

      // Price changes - try to extract from source, default to 0
      const priceChange1h = pickFirstNumber(row.oneHourPriceChange, sourceRow.oneHourPriceChange) ?? 0;
      const priceChange24h = pickFirstNumber(row.oneDayPriceChange, sourceRow.oneDayPriceChange) ?? 0;

      const market: Market = {
        id,
        ticker: pickFirstString(row.ticker, row.slug, sourceRow.ticker, sourceRow.slug, id).toUpperCase(),
        title,
        platform,
        marketSlug,
        eventSlug,
        category: normalizeCategory(row.category ?? row.group ?? row.tag ?? sourceRow.category ?? sourceRow.group ?? sourceRow.tag),
        eventEnd: eventEnd || fetchedAt,
        settlementRules: pickFirstString(row.rules, row.description, sourceRow.rules, sourceRow.description, row.rules_primary, sourceRow.rules_primary, 'See exchange rules.'),
        liquidityScore,
        market_url: resolveMarketUrl(row, sourceRow, platform, marketSlug, eventSlug),
        volume24h,
        lastTradeTime,
        lastUpdated,
        yesPrice: +yesPrice.toFixed(4),
        noPrice: +noPrice.toFixed(4),
        impliedProbYes: +(yesPrice * 100).toFixed(1),
        impliedProbNo: +(noPrice * 100).toFixed(1),
        priceChange1h,
        priceChange24h,
      };

      const normalizedQuote: QuoteSnapshot = {
        marketId: id,
        timestamp: pickFirstString(row.timestamp, row.updatedAt, row.lastUpdated, sourceRow.timestamp, sourceRow.updatedAt, sourceRow.lastUpdated, fetchedAt),
        bestYesBid: quote.bestYesBid,
        bestYesAsk: quote.bestYesAsk,
        bestNoBid: +(1 - quote.bestYesAsk).toFixed(4),
        bestNoAsk: +(1 - quote.bestYesBid).toFixed(4),
        spread: +(quote.bestYesAsk - quote.bestYesBid).toFixed(4),
      };

      return { market, quote: normalizedQuote };
    })
    .filter((row): row is { market: Market; quote: QuoteSnapshot } => Boolean(row));

  return {
    markets: normalized.map((row) => row.market),
    quotes: normalized.map((row) => row.quote),
    droppedCount,
  };
};

async function fetchViaEdgeFunction(): Promise<{ rows: unknown[]; providerStatus: Record<string, 'connected' | 'error' | 'empty'> }> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!projectId || !anonKey) return { rows: [], providerStatus: {} };

  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/market-scan`, {
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`market-scan returned ${res.status}`);
  const data = await res.json();
  return {
    rows: data.markets ?? [],
    providerStatus: data.providerStatus ?? {},
  };
}

export async function fetchScanSnapshot(): Promise<ScanSnapshot> {
  const fetchedAt = new Date().toISOString();
  const providerStatus: Record<string, 'connected' | 'error' | 'empty'> = {};

  try {
    // Priority 1: Direct API URL if configured
    if (scannerConfig.apiUrl) {
      const headers: HeadersInit = { Accept: 'application/json' };
      if (scannerConfig.apiKey) {
        headers.Authorization = `Bearer ${scannerConfig.apiKey}`;
        headers['X-API-Key'] = scannerConfig.apiKey;
      }
      const response = await fetch(scannerConfig.apiUrl, { headers });
      if (!response.ok) throw new Error(`Live market API request failed (${response.status}).`);
      const payload = await response.json();
      const { markets, quotes, droppedCount } = normalizeRows(parseArray(payload), fetchedAt);
      const signals = buildSignals(markets, quotes);
      return { fetchedAt, source: 'live-api', markets, quotes, signals, droppedCount, providerStatus: { api: 'connected' } };
    }

    // Priority 2: Edge function (fetches Kalshi + Polymarket server-side, bypasses CORS)
    let result: { rows: unknown[]; providerStatus: Record<string, 'connected' | 'error' | 'empty'> } | null = null;
    try {
      result = await fetchViaEdgeFunction();
    } catch (e) {
      console.warn('Edge function market-scan failed, trying integrations API:', e);
    }

    // Priority 3: Integrations server fallback
    if (!result || result.rows.length === 0) {
      const intResult = await fetchIntegrationMarketsBestEffort();
      if (intResult.rows.length > 0) {
        result = intResult;
      }
    }

    if (!result || result.rows.length === 0) {
      Object.assign(providerStatus, result?.providerStatus ?? {});
      const { DEMO_MARKETS, DEMO_QUOTES, DEMO_SIGNALS } = await import('./demoData');
      return { fetchedAt, source: 'demo', markets: DEMO_MARKETS, quotes: DEMO_QUOTES, signals: DEMO_SIGNALS, droppedCount: 0, providerStatus };
    }

    Object.assign(providerStatus, result.providerStatus);
    const { markets, quotes, droppedCount } = normalizeRows(result.rows, fetchedAt);

    if (markets.length === 0) {
      const { DEMO_MARKETS, DEMO_QUOTES, DEMO_SIGNALS } = await import('./demoData');
      return { fetchedAt, source: 'demo', markets: DEMO_MARKETS, quotes: DEMO_QUOTES, signals: DEMO_SIGNALS, droppedCount, providerStatus };
    }

    const signals = buildSignals(markets, quotes);
    return { fetchedAt, source: 'live-edge', markets, quotes, signals, droppedCount, providerStatus };
  } catch {
    const { DEMO_MARKETS, DEMO_QUOTES, DEMO_SIGNALS } = await import('./demoData');
    return { fetchedAt, source: 'demo', markets: DEMO_MARKETS, quotes: DEMO_QUOTES, signals: DEMO_SIGNALS, droppedCount: 0, providerStatus };
  }
}

function buildSignals(markets: Market[], quotes: QuoteSnapshot[]): Signal[] {
  return quotes
    .map((quote) => {
      const market = markets.find((candidate) => candidate.id === quote.marketId);
      if (!market) return null;

      const mid = (quote.bestYesBid + quote.bestYesAsk) / 2;
      const spreadPct = quote.spread;
      const noMid = 1 - mid;

      // ── HARD FILTERS ──
      // Kill anything too close to resolved — no edge left
      if (mid >= 0.85 || mid <= 0.15) return null;

      // ── CORE METRICS ──
      const yesProfitRoom = Math.max(0, 0.95 - quote.bestYesAsk);   // room if YES wins
      const noProfitRoom  = Math.max(0, 0.95 - quote.bestNoAsk);    // room if NO wins (buying NO)
      const takerCost     = 0.03 * 2; // entry + exit taker fee
      const slipCost      = 0.01 * 2; // entry + exit slippage
      const totalCost     = takerCost + slipCost + spreadPct;

      const yesNetEdge = yesProfitRoom - totalCost;
      const noNetEdge  = noProfitRoom  - totalCost;

      // ── SHARP MONEY INDICATORS ──
      // Volume spike: high 24h volume relative to liquidity = sharp action
      const volumeToLiq = market.liquidityScore > 0 ? market.volume24h / (market.liquidityScore * 100) : 0;
      const volumeSpike = Math.min(1, volumeToLiq / 5); // normalize, caps at 1

      // Price momentum: recent movement shows directional conviction
      const momentum1h  = market.priceChange1h;
      const momentum24h = market.priceChange24h;
      const momStrength  = Math.min(1, (Math.abs(momentum1h) * 8 + Math.abs(momentum24h) * 3));

      // Spread tightening signal: tight spread = market makers confident in fair value
      const spreadQuality = spreadPct < 0.02 ? 1 : spreadPct < 0.04 ? 0.75 : spreadPct < 0.06 ? 0.5 : spreadPct < 0.08 ? 0.25 : 0;

      // Whale flag: big volume + directional move = whale positioning
      const whaleSignal = market.volume24h > 5000 && Math.abs(momentum1h) > 0.02;

      // Time pressure: closer to expiry with movement = sharper signal
      const hoursToExpiry = (new Date(market.eventEnd).getTime() - Date.now()) / 3_600_000;
      const timePressure = hoursToExpiry < 6 ? 1 : hoursToExpiry < 24 ? 0.7 : hoursToExpiry < 72 ? 0.4 : 0.15;

      // ── DIRECTION DECISION (NOT just "who's the favorite") ──
      // Look for DISAGREEMENT between price and sharp indicators
      // The edge is where sharp money diverges from the public line

      let direction: SignalDirection = 'PASS';
      let bestEdge = 0;
      let thesis = '';
      let sentimentBias: Signal['sentimentBias'] = 'neutral';
      let action: Signal['action'] = 'wait';

      const hasMinLiquidity = market.liquidityScore > 20;
      const tradableSpread = spreadPct < 0.08;

      // YES thesis: sharp money pushing price up + enough room
      const yesSharpScore = (
        (momentum1h > 0.005 ? momentum1h * 10 : 0) +   // recent upward push
        (momentum24h > 0.01 ? momentum24h * 5 : 0) +    // 24h trend up
        volumeSpike * 0.3 +                               // volume activity
        (whaleSignal && momentum1h > 0 ? 0.3 : 0)        // whale buying YES
      );

      // NO thesis: sharp money pushing price down + enough room
      const noSharpScore = (
        (momentum1h < -0.005 ? Math.abs(momentum1h) * 10 : 0) +
        (momentum24h < -0.01 ? Math.abs(momentum24h) * 5 : 0) +
        volumeSpike * 0.3 +
        (whaleSignal && momentum1h < 0 ? 0.3 : 0)
      );

      // Contrarian value: price in mid-range with sharp indicators
      const yesValue = mid >= 0.25 && mid <= 0.75 && yesNetEdge > 0.01;
      const noValue  = mid >= 0.25 && mid <= 0.75 && noNetEdge > 0.01;

      if (hasMinLiquidity && tradableSpread) {
        if (yesSharpScore > 0.15 && yesNetEdge > 0.005 && yesValue) {
          direction = 'YES';
          bestEdge = yesNetEdge;
          action = 'paper_buy_yes';
          sentimentBias = 'bullish';
          const sharpLabel = whaleSignal && momentum1h > 0 ? '🐋 Whale accumulation detected. ' : '';
          thesis = `${sharpLabel}Sharp flow: YES momentum +${(momentum1h * 100).toFixed(1)}¢/1h, vol spike ${(volumeSpike * 100).toFixed(0)}%. ` +
            `Entry ${(quote.bestYesAsk * 100).toFixed(0)}¢ → ${(yesProfitRoom * 100).toFixed(0)}¢ room, net edge ${(yesNetEdge * 100).toFixed(1)}¢ after ${(totalCost * 100).toFixed(1)}¢ costs.`;
        } else if (noSharpScore > 0.15 && noNetEdge > 0.005 && noValue) {
          direction = 'NO';
          bestEdge = noNetEdge;
          action = 'paper_buy_no';
          sentimentBias = 'bearish';
          const sharpLabel = whaleSignal && momentum1h < 0 ? '🐋 Whale selling detected. ' : '';
          thesis = `${sharpLabel}Sharp flow: NO momentum ${(momentum1h * 100).toFixed(1)}¢/1h, vol spike ${(volumeSpike * 100).toFixed(0)}%. ` +
            `NO entry ${(quote.bestNoAsk * 100).toFixed(0)}¢ → ${(noProfitRoom * 100).toFixed(0)}¢ room, net edge ${(noNetEdge * 100).toFixed(1)}¢ after costs.`;
        }
        // Fallback: strong value play even without sharp indicators
        else if (yesNetEdge > 0.03 && mid >= 0.30 && mid <= 0.70 && spreadQuality >= 0.5) {
          direction = 'YES';
          bestEdge = yesNetEdge;
          action = 'paper_buy_yes';
          sentimentBias = 'bullish';
          thesis = `Value entry: YES at ${(quote.bestYesAsk * 100).toFixed(0)}¢ in liquid market. ` +
            `${(yesProfitRoom * 100).toFixed(0)}¢ room, tight spread (${(spreadPct * 100).toFixed(1)}¢), net edge ${(yesNetEdge * 100).toFixed(1)}¢.`;
        } else if (noNetEdge > 0.03 && mid >= 0.30 && mid <= 0.70 && spreadQuality >= 0.5) {
          direction = 'NO';
          bestEdge = noNetEdge;
          action = 'paper_buy_no';
          sentimentBias = 'bearish';
          thesis = `Value entry: NO at ${(quote.bestNoAsk * 100).toFixed(0)}¢. ` +
            `${(noProfitRoom * 100).toFixed(0)}¢ room, tight spread (${(spreadPct * 100).toFixed(1)}¢), net edge ${(noNetEdge * 100).toFixed(1)}¢.`;
        } else {
          // Not enough edge — PASS
          direction = 'PASS';
          thesis = `No sharp edge. YES room ${(yesProfitRoom * 100).toFixed(0)}¢, NO room ${(noProfitRoom * 100).toFixed(0)}¢, costs ${(totalCost * 100).toFixed(1)}¢. Need momentum or tighter spread.`;
        }
      } else if (!hasMinLiquidity) {
        thesis = `Low liquidity (${market.liquidityScore}). Slippage will eat the edge.`;
      } else {
        thesis = `Spread too wide (${(spreadPct * 100).toFixed(1)}¢). Wait for tightening.`;
      }

      // ── COMPOSITE SCORE ──
      // Weight: edge (35%), sharp indicators (25%), spread quality (20%), liquidity (10%), time pressure (10%)
      const edgeScore = Math.min(1, bestEdge * 8);
      const sharpScore = Math.min(1, Math.max(yesSharpScore, noSharpScore));
      const score = direction === 'PASS' ? 0 : Math.round(
        (edgeScore * 0.35 + sharpScore * 0.25 + spreadQuality * 0.20 +
         (market.liquidityScore / 100) * 0.10 + timePressure * 0.10) * 100
      );

      const confidence = direction === 'PASS' ? 0 : Math.min(95, Math.max(15, Math.round(
        edgeScore * 30 + sharpScore * 25 + spreadQuality * 20 + (market.liquidityScore / 100) * 15 + timePressure * 10
      )));

      // ── ENTRY/TARGET/STOP ──
      const entryPrice = direction === 'YES' ? quote.bestYesAsk : direction === 'NO' ? quote.bestNoAsk : mid;
      const profitRoom = direction === 'YES' ? yesProfitRoom : noProfitRoom;
      const entryLow = entryPrice;
      const entryHigh = Math.min(0.95, entryLow + 0.02);
      const targetPrice = direction !== 'PASS'
        ? Math.min(0.92, entryLow + Math.max(0.06, profitRoom * 0.65))
        : mid;
      const invalidationPrice = direction !== 'PASS'
        ? Math.max(0.03, entryLow - Math.max(0.04, profitRoom * 0.3))
        : mid;

      const riskReward = targetPrice - entryLow > 0 && entryLow - invalidationPrice > 0
        ? +((targetPrice - entryLow) / (entryLow - invalidationPrice)).toFixed(2)
        : 0;

      const catalystStrength = Math.min(100, Math.round(
        timePressure * 40 + momStrength * 40 + volumeSpike * 20
      ));

      const setupType = direction === 'PASS' ? 'No Setup'
        : whaleSignal ? 'Whale Play'
        : sharpScore > 0.4 ? 'Sharp Flow'
        : catalystStrength > 50 ? 'Catalyst Play'
        : spreadQuality >= 0.75 ? 'Value Entry'
        : 'Spread Capture';

      return {
        id: `sig-${market.id}`,
        marketId: market.id,
        setupType,
        score,
        expectedNetEdge: bestEdge,
        confidence,
        action,
        direction,
        rationale: `Edge ${(bestEdge * 100).toFixed(1)}¢ | Sharp ${(sharpScore * 100).toFixed(0)}% | Spread ${(spreadPct * 100).toFixed(1)}¢ | Vol ${market.volume24h}`,
        thesis,
        momentum: momStrength,
        imbalance: clamp01(1 - spreadPct * 10),
        timeToExpiry: formatTimeToExpiry(market.eventEnd),
        entryZone: [+entryLow.toFixed(4), +entryHigh.toFixed(4)] as [number, number],
        targetPrice: +targetPrice.toFixed(4),
        invalidationPrice: +invalidationPrice.toFixed(4),
        riskReward,
        catalystStrength,
        sentimentBias,
        smartMoneyFlag: whaleSignal,
      } satisfies Signal;
    })
    .filter((row): row is Signal => Boolean(row) && row.direction !== 'PASS')
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

function formatTimeToExpiry(eventEnd: string): string {
  const ms = new Date(eventEnd).getTime() - Date.now();
  if (!Number.isFinite(ms)) return 'Unknown';
  const hours = Math.round(ms / (1000 * 60 * 60));
  if (hours < 0) return 'Expired';
  if (hours < 1) return `${Math.round(ms / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
