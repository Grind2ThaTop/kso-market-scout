import type { Market } from '@/data/types';

const buildPolymarketUrl = (market: Pick<Market, 'marketSlug' | 'id'>): string | null => {
  const slugOrId = market.marketSlug?.trim() || market.id;
  if (!slugOrId) return null;
  return `https://polymarket.com/market/${slugOrId}`;
};

const buildKalshiUrl = (market: Pick<Market, 'eventSlug' | 'marketSlug'>): string | null => {
  if (!market.eventSlug || !market.marketSlug) return null;
  return `https://kalshi.com/markets/${market.eventSlug}/${market.marketSlug}`;
};

export const buildMarketUrl = (market: Pick<Market, 'platform' | 'id' | 'marketSlug' | 'eventSlug'>): string | null => {
  if (market.platform === 'polymarket') {
    return buildPolymarketUrl(market);
  }

  if (market.platform === 'kalshi') {
    return buildKalshiUrl(market);
  }

  return null;
};

export const buildOutcomeTradeUrl = (market: Pick<Market, 'market_url' | 'platform'>, side: 'yes' | 'no'): string => {
  const url = new URL(market.market_url);

  if (market.platform === 'polymarket') {
    url.searchParams.set('outcome', side.toUpperCase());
  } else if (market.platform === 'kalshi') {
    url.searchParams.set('side', side);
  }

  return url.toString();
};
