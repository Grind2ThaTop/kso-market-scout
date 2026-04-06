import type { Market } from '@/data/types';

const buildPolymarketUrl = (market: Pick<Market, 'marketSlug'>): string | null => {
  const slug = market.marketSlug?.trim();
  if (!slug) return null;
  // Polymarket event pages: https://polymarket.com/event/{slug}
  // If slug looks like a condition ID (hex), link to it directly
  if (/^0x[0-9a-fA-F]+$/.test(slug)) {
    return `https://polymarket.com/event/${slug}`;
  }
  return `https://polymarket.com/event/${slug}`;
};

const buildKalshiUrl = (market: Pick<Market, 'eventSlug' | 'marketSlug'>): string | null => {
  const eventSlug = market.eventSlug?.trim()?.toLowerCase();
  const marketSlug = market.marketSlug?.trim()?.toLowerCase();
  // Kalshi format: /markets/event-ticker/market-ticker or just /markets/event-ticker
  if (eventSlug && marketSlug) return `https://kalshi.com/markets/${eventSlug}/${marketSlug}`;
  if (eventSlug) return `https://kalshi.com/markets/${eventSlug}`;
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
