import type { Market } from '@/data/types';

const buildPolymarketUrl = (market: Pick<Market, 'marketSlug' | 'eventSlug'>): string | null => {
  const slug = market.eventSlug?.trim() || market.marketSlug?.trim();
  if (!slug) return null;
  return `https://polymarket.com/event/${slug}`;
};

const deriveKalshiSeriesSlug = (market: Pick<Market, 'seriesSlug' | 'eventSlug' | 'marketSlug'>): string | null => {
  const rawSlug = market.seriesSlug?.trim() || market.eventSlug?.trim() || market.marketSlug?.trim();
  if (!rawSlug) return null;
  return rawSlug.replace(/-[0-9].*$/, '').toLowerCase();
};

const buildKalshiUrl = (market: Pick<Market, 'seriesSlug' | 'eventSlug' | 'marketSlug'>): string | null => {
  const seriesSlug = deriveKalshiSeriesSlug(market);
  if (!seriesSlug) return null;
  return `https://kalshi.com/markets/${seriesSlug}`;
};

export const buildMarketUrl = (market: Pick<Market, 'platform' | 'marketSlug' | 'eventSlug' | 'seriesSlug'>): string | null => {
  if (market.platform === 'polymarket') {
    return buildPolymarketUrl(market);
  }

  if (market.platform === 'kalshi') {
    return buildKalshiUrl(market);
  }

  return null;
};

export const buildOutcomeTradeUrl = (
  market: Pick<Market, 'market_url' | 'platform' | 'marketSlug' | 'eventSlug' | 'seriesSlug'>,
  _side: 'yes' | 'no',
): string => {
  return buildMarketUrl(market) || market.market_url;
};
