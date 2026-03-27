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
  if (raw.includes('sport') || raw.includes('nba') || raw.includes('nfl') || raw.includes('ufc') || raw.includes('mlb') || raw.includes('nhl')) return 'sports';
  if (raw.includes('polit') || raw.includes('elect') || raw.includes('senate') || raw.includes('congress')) return 'politics';
  if (raw.includes('weath') || raw.includes('temp') || raw.includes('rain') || raw.includes('snow') || raw.includes('hurricane')) return 'weather';
  if (raw.includes('cult') || raw.includes('entertain') || raw.includes('movie') || raw.includes('music')) return 'culture';
  return 'economics';
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
  source: 'live-api' | 'integrations-api' | 'demo';
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
    row.market_url, row.marketUrl, row.url, row.permalink,
    sourceRow.market_url, sourceRow.marketUrl, sourceRow.url, sourceRow.permalink,
  );
  if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) return directUrl;
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

      const eventEnd = pickFirstString(
        row.eventEnd, row.endDate, row.end_date, row.closeTime, row.close_time, row.expiration, row.expiration_time,
        sourceRow.eventEnd, sourceRow.endDate, sourceRow.end_date, sourceRow.closeTime, sourceRow.close_time, sourceRow.expiration, sourceRow.expiration_time,
      );

      const volume24h = pickFirstNumber(
        row.volume24hr, sourceRow.volume24hr, row.volume_24h, sourceRow.volume_24h,
        row.volume24h, sourceRow.volume24h,
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
        row.eventSlug, row.event, row.series_ticker, sourceRow.eventSlug, sourceRow.event, sourceRow.event_ticker, sourceRow.series_ticker,
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

export async function fetchScanSnapshot(): Promise<ScanSnapshot> {
  const fetchedAt = new Date().toISOString();
  const providerStatus: Record<string, 'connected' | 'error' | 'empty'> = {};

  try {
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

    const result = await fetchIntegrationMarketsBestEffort();
    Object.assign(providerStatus, result.providerStatus);

    if (result.rows.length === 0) {
      // No live data at all - fall back to demo
      const { DEMO_MARKETS, DEMO_QUOTES, DEMO_SIGNALS } = await import('./demoData');
      return { fetchedAt, source: 'demo', markets: DEMO_MARKETS, quotes: DEMO_QUOTES, signals: DEMO_SIGNALS, droppedCount: 0, providerStatus };
    }

    const { markets, quotes, droppedCount } = normalizeRows(result.rows, fetchedAt);

    if (markets.length === 0) {
      // All markets were filtered out (stale/dead) - fall back to demo
      const { DEMO_MARKETS, DEMO_QUOTES, DEMO_SIGNALS } = await import('./demoData');
      return { fetchedAt, source: 'demo', markets: DEMO_MARKETS, quotes: DEMO_QUOTES, signals: DEMO_SIGNALS, droppedCount, providerStatus };
    }

    const signals = buildSignals(markets, quotes);
    return { fetchedAt, source: 'integrations-api', markets, quotes, signals, droppedCount, providerStatus };
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
      const momentum = clamp01(Math.abs(0.5 - mid) * 2);
      const imbalance = clamp01(1 - quote.spread * 10);
      const expectedNetEdge = Math.max(0, 0.03 - quote.spread / 2);
      const score = Math.round((momentum * 0.35 + imbalance * 0.35 + expectedNetEdge * 8 + (market.liquidityScore / 100) * 0.3) * 100);
      const confidence = Math.min(95, Math.max(20, Math.round((market.liquidityScore / 100) * 80 + momentum * 15)));

      // Signal direction logic - more aggressive thresholds
      let direction: SignalDirection = 'PASS';
      let action: Signal['action'] = 'wait';
      let thesis = 'No clear edge detected.';
      let sentimentBias: Signal['sentimentBias'] = 'neutral';

      const spreadPct = quote.spread;
      const hasMinLiquidity = market.liquidityScore > 25;
      const tradableSpread = spreadPct < 0.08; // 8¢ max spread

      if (hasMinLiquidity && tradableSpread) {
        // Strong directional signal: mid clearly above/below 50
        if (mid >= 0.58) {
          direction = 'YES';
          action = 'paper_buy_yes';
          sentimentBias = 'bullish';
          thesis = `YES favored at ${(mid * 100).toFixed(0)}¢. Spread ${(spreadPct * 100).toFixed(1)}¢, liquidity ${market.liquidityScore}. Market pricing this event as likely.`;
        } else if (mid <= 0.42) {
          direction = 'NO';
          action = 'paper_buy_no';
          sentimentBias = 'bearish';
          thesis = `NO favored (YES only ${(mid * 100).toFixed(0)}¢). Market pricing event as unlikely. Buy NO side for value.`;
        } else if (mid >= 0.52) {
          // Slight YES lean
          direction = 'YES';
          action = 'paper_buy_yes';
          sentimentBias = 'bullish';
          thesis = `Slight YES lean at ${(mid * 100).toFixed(0)}¢. ${spreadPct < 0.03 ? 'Tight spread supports entry.' : 'Watch for spread tightening.'} Liq: ${market.liquidityScore}.`;
        } else if (mid <= 0.48) {
          // Slight NO lean
          direction = 'NO';
          action = 'paper_buy_no';
          sentimentBias = 'bearish';
          thesis = `Slight NO lean (YES at ${(mid * 100).toFixed(0)}¢). ${spreadPct < 0.03 ? 'Tight spread supports entry.' : 'Monitor for confirmation.'} Liq: ${market.liquidityScore}.`;
        } else {
          // True coin flip — look for momentum or just pass
          if (Math.abs(market.priceChange1h) > 0.01) {
            direction = market.priceChange1h > 0 ? 'YES' : 'NO';
            action = market.priceChange1h > 0 ? 'paper_buy_yes' : 'paper_buy_no';
            sentimentBias = market.priceChange1h > 0 ? 'bullish' : 'bearish';
            thesis = `Coin-flip market with ${market.priceChange1h > 0 ? 'upward' : 'downward'} momentum (${(market.priceChange1h * 100).toFixed(1)}¢/1h). Momentum play.`;
          } else {
            direction = 'PASS';
            thesis = `True 50/50, no momentum, spread ${(spreadPct * 100).toFixed(1)}¢. Wait for catalyst.`;
          }
        }
      } else if (!hasMinLiquidity) {
        // Even low-liq markets get a direction if price is extreme
        if (mid >= 0.70) {
          direction = 'YES'; action = 'paper_buy_yes'; sentimentBias = 'bullish';
          thesis = `Strong YES at ${(mid * 100).toFixed(0)}¢ but low liquidity (${market.liquidityScore}). Caution on size.`;
        } else if (mid <= 0.30) {
          direction = 'NO'; action = 'paper_buy_no'; sentimentBias = 'bearish';
          thesis = `Strong NO signal (YES at ${(mid * 100).toFixed(0)}¢) but low liquidity (${market.liquidityScore}). Small size only.`;
        } else {
          thesis = `Low liquidity (${market.liquidityScore}). Slippage risk too high for edge capture.`;
        }
      } else {
        thesis = `Spread too wide (${(spreadPct * 100).toFixed(1)}¢). Wait for tightening.`;
      }

      // Entry/target/invalidation zones
      const entryLow = direction === 'YES' ? quote.bestYesAsk : direction === 'NO' ? quote.bestNoAsk : mid;
      const entryHigh = entryLow + 0.02;
      const targetPrice = direction === 'YES'
        ? Math.min(0.95, entryLow + 0.08)
        : direction === 'NO'
          ? Math.min(0.95, (1 - mid) + 0.08)
          : mid;
      const invalidationPrice = direction === 'YES'
        ? Math.max(0.05, entryLow - 0.06)
        : direction === 'NO'
          ? Math.max(0.05, (1 - mid) - 0.06)
          : mid;

      const riskReward = targetPrice - entryLow > 0 && entryLow - invalidationPrice > 0
        ? +((targetPrice - entryLow) / (entryLow - invalidationPrice)).toFixed(2)
        : 0;

      // Catalyst strength - based on how close to event and price movement
      const hoursToExpiry = (new Date(market.eventEnd).getTime() - Date.now()) / 3_600_000;
      const catalystStrength = Math.min(100, Math.round(
        (hoursToExpiry < 24 ? 40 : hoursToExpiry < 72 ? 20 : 10) +
        Math.abs(market.priceChange1h) * 500 +
        Math.abs(market.priceChange24h) * 200
      ));

      // Smart money flag - inferred from volume + price movement pattern
      const smartMoneyFlag = market.volume24h > 10000 && Math.abs(market.priceChange1h) > 0.03;

      return {
        id: `sig-${market.id}`,
        marketId: market.id,
        setupType: direction === 'PASS' ? 'No Setup' : catalystStrength > 50 ? 'Catalyst Play' : momentum > 0.6 ? 'Momentum Entry' : 'Spread Capture',
        score,
        expectedNetEdge,
        confidence,
        action,
        direction,
        rationale: `Spread ${(quote.spread * 100).toFixed(1)}¢ | Liq ${market.liquidityScore} | Vol $${market.volume24h.toLocaleString()}`,
        thesis,
        momentum,
        imbalance,
        timeToExpiry: formatTimeToExpiry(market.eventEnd),
        entryZone: [+entryLow.toFixed(4), +entryHigh.toFixed(4)] as [number, number],
        targetPrice: +targetPrice.toFixed(4),
        invalidationPrice: +invalidationPrice.toFixed(4),
        riskReward,
        catalystStrength,
        sentimentBias,
        smartMoneyFlag,
      } satisfies Signal;
    })
    .filter((row): row is Signal => Boolean(row))
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
