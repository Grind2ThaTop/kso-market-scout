import type { Market } from '@/data/types';

const buildPolymarketUrl = (market: Pick<Market, 'marketSlug'>): string | null => {
  const slug = market.marketSlug?.trim();
  if (!slug) return null;
  return `https://polymarket.com/market/${slug}`;
};

const buildKalshiUrl = (market: Pick<Market, 'eventSlug' | 'marketSlug'>): string | null => {
  if (!market.eventSlug || !market.marketSlug) return null;
  return `https://kalshi.com/markets/${market.eventSlug}/${market.marketSlug}`;
};

export const buildMarketUrl = (market: Pick<Market, 'platform' | 'marketSlug' | 'eventSlug'>): string | null => {
  if (market.platform === 'polymarket') {
    return buildPolymarketUrl(market);
  }

  if (market.platform === 'kalshi') {
    return buildKalshiUrl(market);
  }

  return null;
};

export const buildOutcomeTradeUrl = (market: Pick<Market, 'market_url' | 'platform'>, _side: 'yes' | 'no'): string => {
  return market.market_url;
};
