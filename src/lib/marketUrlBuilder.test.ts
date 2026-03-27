import { describe, expect, it } from 'vitest';
import { buildMarketUrl } from './marketUrlBuilder';

describe('buildMarketUrl', () => {
  it('builds polymarket event URLs', () => {
    expect(buildMarketUrl({ platform: 'polymarket', marketSlug: 'bitcoin-100k', eventSlug: '' })).toBe(
      'https://polymarket.com/event/bitcoin-100k',
    );
  });

  it('builds kalshi event + market URLs when both are present', () => {
    expect(buildMarketUrl({ platform: 'kalshi', eventSlug: 'kxbtc', marketSlug: 'kxbtc-26mar31-b95000' })).toBe(
      'https://kalshi.com/markets/kxbtc/kxbtc-26mar31-b95000',
    );
  });

  it('falls back to kalshi market-only URL when event slug is missing', () => {
    expect(buildMarketUrl({ platform: 'kalshi', eventSlug: '', marketSlug: 'kxbtc-26mar31-b95000' })).toBe(
      'https://kalshi.com/markets/kxbtc-26mar31-b95000',
    );
  });
});
