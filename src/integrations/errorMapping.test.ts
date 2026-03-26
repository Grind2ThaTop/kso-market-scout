import { describe, expect, it } from 'vitest';
import { mapProviderMessageToErrorCode } from './errorMapping';

describe('mapProviderMessageToErrorCode', () => {
  it('maps auth failures', () => {
    expect(mapProviderMessageToErrorCode('HTTP 401 unauthorized')).toBe('auth_failed');
  });

  it('maps rate limits', () => {
    expect(mapProviderMessageToErrorCode('HTTP 429 too many requests')).toBe('rate_limited');
  });

  it('defaults to upstream', () => {
    expect(mapProviderMessageToErrorCode('unexpected provider fault')).toBe('upstream_error');
  });
});
