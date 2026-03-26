import { Market, QuoteSnapshot, Signal, TradingProfile } from './types';

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
  markets: Market[];
  quotes: QuoteSnapshot[];
  signals: Signal[];
}

export interface ScannerConfig {
  apiUrl?: string;
  apiKey?: string;
  pollIntervalMs: number;
  profile: TradingProfile;
}

export const scannerConfig: ScannerConfig = {
  apiUrl: import.meta.env.VITE_MARKET_DATA_URL,
  apiKey: import.meta.env.VITE_MARKET_DATA_API_KEY,
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
    super('Live market data source is not configured. Set VITE_MARKET_DATA_URL.');
  }
}

export async function fetchScanSnapshot(): Promise<ScanSnapshot> {
  if (!scannerConfig.apiUrl) throw new MissingDataSourceError();

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
  const rows = parseArray(payload);
  const fetchedAt = new Date().toISOString();

  const normalized = rows
    .map((item): { market: Market; quote: QuoteSnapshot } | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id =
        String(row.id ?? row.marketId ?? row.conditionId ?? row.ticker ?? row.slug ?? '').trim();
      const title = String(row.title ?? row.question ?? row.name ?? '').trim();
      if (!id || !title) return null;

      const quote = inferQuote(row);
      if (!quote) return null;

      const eventEnd = String(
        row.eventEnd ?? row.endDate ?? row.end_date ?? row.closeTime ?? row.expiration ?? fetchedAt,
      );
      const volume = toNumber(row.volume24h) ?? toNumber(row.volume) ?? toNumber(row.liquidity) ?? 0;
      const liquidityScore = Math.max(1, Math.min(99, Math.round(Math.log10(volume + 10) * 30)));

      const market: Market = {
        id,
        ticker: String(row.ticker ?? row.slug ?? id).toUpperCase(),
        title,
        category: normalizeCategory(row.category ?? row.group ?? row.tag),
        eventEnd,
        settlementRules: String(row.rules ?? row.description ?? 'See exchange rules.'),
        liquidityScore,
      };

      const normalizedQuote: QuoteSnapshot = {
        marketId: id,
        timestamp: String(row.timestamp ?? row.updatedAt ?? row.lastUpdated ?? fetchedAt),
        bestYesBid: quote.bestYesBid,
        bestYesAsk: quote.bestYesAsk,
        bestNoBid: +(1 - quote.bestYesAsk).toFixed(4),
        bestNoAsk: +(1 - quote.bestYesBid).toFixed(4),
        spread: +(quote.bestYesAsk - quote.bestYesBid).toFixed(4),
      };

      return { market, quote: normalizedQuote };
    })
    .filter((row): row is { market: Market; quote: QuoteSnapshot } => Boolean(row));

  const markets = normalized.map((row) => row.market);
  const quotes = normalized.map((row) => row.quote);
  const signals = buildSignals(markets, quotes);

  return { fetchedAt, markets, quotes, signals };
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
