import { Provider, ProviderStatus } from './types';

export function deriveProviderStatus(provider: Provider, credentialsValid: boolean | undefined, health: { connected: boolean; degraded: boolean; rateLimited: boolean }): ProviderStatus {
  if (credentialsValid === false) return 'invalid';
  if (health.rateLimited) return 'rate-limited';
  if (!health.connected) return health.degraded ? 'degraded' : 'disconnected';
  if (health.degraded) return 'degraded';
  if (credentialsValid === true) return 'connected';
  return provider === 'polymarket' ? 'degraded' : 'disconnected';
}
