import { describe, expect, it } from 'vitest';
import { buildMarketUrl } from './marketUrlBuilder';

describe('buildMarketUrl', () => {
  it('prefers polymarket event slugs for public event URLs', () => {
    expect(
      buildMarketUrl({
        platform: 'polymarket',
        eventSlug: 'who-will-win-a-calendar-grand-slam-in-2026',
        marketSlug: 'carlos-alcaraz',
        seriesSlug: undefined,
      }),
    ).toBe('https://polymarket.com/event/who-will-win-a-calendar-grand-slam-in-2026');
  });

  it('builds kalshi series URLs when series slug is present', () => {
    expect(
      buildMarketUrl({
        platform: 'kalshi',
        seriesSlug: 'KXBOND',
        eventSlug: 'KXBOND-30',
        marketSlug: 'KXBOND-30-CAL',
      }),
    ).toBe('https://kalshi.com/markets/kxbond');
  });

  it('derives kalshi series URL from event ticker when series slug is missing', () => {
    expect(
      buildMarketUrl({
        platform: 'kalshi',
        seriesSlug: undefined,
        eventSlug: 'KXNEWPOPE-70',
        marketSlug: 'KXNEWPOPE-70-PPIZ',
      }),
    ).toBe('https://kalshi.com/markets/kxnewpope');
  });

  it('falls back to deriving kalshi series URL from market ticker', () => {
    expect(
      buildMarketUrl({
        platform: 'kalshi',
        seriesSlug: undefined,
        eventSlug: '',
        marketSlug: 'KXBTC-26MAR31-B95000',
      }),
    ).toBe('https://kalshi.com/markets/kxbtc');
  });
});
