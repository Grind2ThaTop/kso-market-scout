import type { Market } from '@/data/types';

const buildPolymarketUrl = (market: Pick<Market, 'marketSlug'>): string | null => {
  const slug = market.marketSlug?.trim();
  if (!slug) return null;
  return `https://polymarket.com/event/${slug}`;
};

const buildKalshiUrl = (market: Pick<Market, 'eventSlug' | 'marketSlug'>): string | null => {
  const eventSlug = market.eventSlug?.trim();
  const marketSlug = market.marketSlug?.trim();
  if (eventSlug && marketSlug) return `https://kalshi.com/markets/${eventSlug}/${marketSlug}`;
  if (marketSlug) return `https://kalshi.com/markets/${marketSlug}`;
  return null;
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
