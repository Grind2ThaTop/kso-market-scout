import { describe, expect, it } from 'vitest';
import { signPolymarketL2 } from './signing';

describe('signPolymarketL2', () => {
  it('returns deterministic signatures', () => {
    const a = signPolymarketL2({ timestamp: '1700000000', method: 'GET', path: '/orders', secret: 'abc' });
    const b = signPolymarketL2({ timestamp: '1700000000', method: 'GET', path: '/orders', secret: 'abc' });
    expect(a).toBe(b);
  });
});
