import { Market, QuoteSnapshot, Signal, TradingProfile } from './types';
import { buildMarketUrl } from '@/lib/marketUrlBuilder';

const DEFAULT_POLL_MS = 15000;

const clamp01 = (value: number) => Math.max(0.01, Math.min(0.99, value));

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
  if (raw.includes('sport')) return 'sports';
  if (raw.includes('polit')) return 'politics';
  if (raw.includes('weath')) return 'weather';
  if (raw.includes('cult') || raw.includes('entertain')) return 'culture';
  return 'economics';
};

const inferQuote = (row: Record<string, unknown>) => {
  const bid =
    toNumber(row.bestYesBid) ??
    toNumber(row.bestBid) ??
    toNumber(row.yesBid) ??
    toNumber(row.lastTradePrice) ??
    toNumber(row.last_price);
  const ask =
    toNumber(row.bestYesAsk) ??
    toNumber(row.bestAsk) ??
    toNumber(row.yesAsk) ??
    bid;

  if (bid == null || ask == null) return null;

  const bestYesBid = clamp01(Math.min(bid, ask));
  const bestYesAsk = clamp01(Math.max(bid, ask));
  return {
    bestYesBid,
    bestYesAsk,
  };
};

export interface ScanSnapshot {
  fetchedAt: string;
  source: 'live-api' | 'integrations-api' | 'demo';
  markets: Market[];
  quotes: QuoteSnapshot[];
  signals: Signal[];
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

const fetchIntegrationProviderMarkets = async (provider: 'kalshi' | 'polymarket') => {
  const base = resolveIntegrationsBase();
  const url = `${base}/api/prediction-markets/markets?provider=${provider}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Integrations market request failed (${provider}, ${response.status}).`);
  return response.json();
};

const fetchIntegrationMarketsBestEffort = async () => {
  const results = await Promise.allSettled([
    fetchIntegrationProviderMarkets('kalshi'),
    fetchIntegrationProviderMarkets('polymarket'),
  ]);

  const mergedRows: unknown[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      mergedRows.push(...parseArray(result.value));
    }
  }

  return mergedRows;
};

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
);

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
    row.market_url,
    row.marketUrl,
    row.url,
    row.permalink,
    sourceRow.market_url,
    sourceRow.marketUrl,
    sourceRow.url,
    sourceRow.permalink,
  );
  if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) return directUrl;
  return buildMarketUrl({ platform, marketSlug, eventSlug }) || '';
};

const normalizeRows = (rows: unknown[], fetchedAt: string) => {
  const normalized = rows
    .map((item): { market: Market; quote: QuoteSnapshot } | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const sourceRow = extractSourceRow(row);

      const id = pickFirstString(row.id, row.marketId, row.conditionId, row.ticker, row.slug, sourceRow.id, sourceRow.ticker, sourceRow.conditionId);
      const title = pickFirstString(row.title, row.question, row.name, sourceRow.title, sourceRow.question, sourceRow.name);
      if (!id || !title) return null;

      const quote = inferQuote({ ...sourceRow, ...row });
      if (!quote) return null;

      const eventEnd = pickFirstString(
        row.eventEnd, row.endDate, row.end_date, row.closeTime, row.expiration,
        sourceRow.eventEnd, sourceRow.endDate, sourceRow.end_date, sourceRow.closeTime, sourceRow.expiration,
      );
      const status = pickFirstString(row.status, sourceRow.status).toLowerCase();
      const activeFlag = row.active ?? sourceRow.active;
      const isInactive = activeFlag === false || String(activeFlag).toLowerCase() === 'false';
      const isClosedStatus = /(closed|resolved|settled|final|expired|inactive)/.test(status);
      const eventEndMs = eventEnd ? new Date(eventEnd).getTime() : Number.NaN;
      const isExpired = Number.isFinite(eventEndMs) && eventEndMs <= Date.now();
      if (isInactive || isClosedStatus || isExpired) return null;

      const volume = pickFirstNumber(
        row.volume24h, row.volume, row.liquidity,
        sourceRow.volume24h, sourceRow.volume, sourceRow.liquidity, sourceRow.volume_num,
        0,
      ) ?? 0;
      const liquidityScore = Math.max(1, Math.min(99, Math.round(Math.log10(volume + 10) * 30)));

      const platform = (pickFirstString(row.platform, row.provider, sourceRow.platform, sourceRow.provider, 'polymarket').toLowerCase() as Market['platform']) || 'polymarket';
      const marketSlug = pickFirstString(
        row.marketSlug, row.slug, row.conditionSlug, row.ticker,
        sourceRow.marketSlug, sourceRow.slug, sourceRow.conditionSlug, sourceRow.ticker,
      );
      const eventSlug = pickFirstString(row.eventSlug, row.event, row.series_ticker, sourceRow.eventSlug, sourceRow.event, sourceRow.event_ticker, sourceRow.series_ticker);

      const market: Market = {
        id,
        ticker: pickFirstString(row.ticker, row.slug, sourceRow.ticker, sourceRow.slug, id).toUpperCase(),
        title,
        platform,
        marketSlug,
        eventSlug,
        category: normalizeCategory(row.category ?? row.group ?? row.tag ?? sourceRow.category ?? sourceRow.group ?? sourceRow.tag),
        eventEnd: eventEnd || fetchedAt,
        settlementRules: pickFirstString(row.rules, row.description, sourceRow.rules, sourceRow.description, 'See exchange rules.'),
        liquidityScore,
        market_url: resolveMarketUrl(row, sourceRow, platform, marketSlug, eventSlug),
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
  };
};

export async function fetchScanSnapshot(): Promise<ScanSnapshot> {
  const fetchedAt = new Date().toISOString();
  try {
    if (scannerConfig.apiUrl) {
      const headers: HeadersInit = { Accept: 'application/json' };
      if (scannerConfig.apiKey) {
        headers.Authorization = `Bearer ${scannerConfig.apiKey}`;
        headers['X-API-Key'] = scannerConfig.apiKey;
      }
      const response = await fetch(scannerConfig.apiUrl, { headers });
      if (!response.ok) {
        throw new Error(`Live market API request failed (${response.status}).`);
      }
      const payload = await response.json();
      const { markets, quotes } = normalizeRows(parseArray(payload), fetchedAt);
      const signals = buildSignals(markets, quotes);
      return { fetchedAt, source: 'live-api', markets, quotes, signals };
    }

    const mergedRows = await fetchIntegrationMarketsBestEffort();
    if (mergedRows.length === 0) throw new MissingDataSourceError();

    const { markets, quotes } = normalizeRows(mergedRows, fetchedAt);
    const signals = buildSignals(markets, quotes);
    return { fetchedAt, source: 'integrations-api', markets, quotes, signals };
  } catch {
    // Fall back to demo data when live endpoints are unavailable
    const { DEMO_MARKETS, DEMO_QUOTES, DEMO_SIGNALS } = await import('./demoData');
    return {
      fetchedAt,
      source: 'demo',
      markets: DEMO_MARKETS,
      quotes: DEMO_QUOTES,
      signals: DEMO_SIGNALS,
    };
  }
}

function buildSignals(markets: Market[], quotes: QuoteSnapshot[]): Signal[] {
  return quotes
    .map((quote) => {
      const market = markets.find((candidate) => candidate.id === quote.marketId);
      if (!market) return null;

      const momentum = clamp01(Math.abs(0.5 - quote.bestYesBid) * 2);
      const imbalance = clamp01(1 - quote.spread * 20);
      const expectedNetEdge = Math.max(0, 0.02 - quote.spread / 2);
      const score = Math.round((momentum * 0.4 + imbalance * 0.4 + expectedNetEdge * 10) * 100);
      const confidence = Math.min(95, Math.max(30, Math.round((market.liquidityScore / 100) * 90)));
      const action: Signal['action'] = expectedNetEdge > 0.01
        ? quote.bestYesBid >= 0.5
          ? 'paper_buy_yes'
          : 'paper_buy_no'
        : 'wait';

      return {
        id: `sig-${market.id}`,
        marketId: market.id,
        setupType: 'Live spread scanner',
        score,
        expectedNetEdge,
        confidence,
        action,
        rationale: `Generated from live quote spread (${(quote.spread * 100).toFixed(2)}¢) and liquidity score (${market.liquidityScore}).`,
        momentum,
        imbalance,
        timeToExpiry: formatTimeToExpiry(market.eventEnd),
      } satisfies Signal;
    })
    .filter((row): row is Signal => Boolean(row))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
}

function formatTimeToExpiry(eventEnd: string): string {
  const ms = new Date(eventEnd).getTime() - Date.now();
  if (!Number.isFinite(ms)) return 'Unknown';
  const hours = Math.round(ms / (1000 * 60 * 60));
  if (hours < 0) return 'Expired';
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
