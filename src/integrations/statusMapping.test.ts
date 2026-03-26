import { describe, expect, it } from 'vitest';
import { deriveProviderStatus } from './statusMapping';

describe('deriveProviderStatus', () => {
  it('prioritizes invalid credentials', () => {
    expect(deriveProviderStatus('kalshi', false, { connected: true, degraded: false, rateLimited: false })).toBe('invalid');
  });

  it('maps healthy + validated to connected', () => {
    expect(deriveProviderStatus('kalshi', true, { connected: true, degraded: false, rateLimited: false })).toBe('connected');
  });

  it('maps connected but unvalidated polymarket to degraded', () => {
    expect(deriveProviderStatus('polymarket', undefined, { connected: true, degraded: false, rateLimited: false })).toBe('degraded');
  });
});
