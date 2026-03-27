export type Provider = 'polymarket' | 'kalshi';
export type ProviderStatus = 'disconnected' | 'invalid' | 'connected' | 'rate-limited' | 'degraded';

export interface IntegrationRecord {
  provider: Provider;
  enabled: boolean;
  environment: 'prod' | 'demo';
  credentials?: Record<string, string>;
  status?: ProviderStatus;
  credentialsValid?: boolean;
  lastTestedAt?: string;
  lastSuccessfulSyncAt?: string;
  credentialsMetadata?: {
    apiKey_masked?: string | null;
    hasPrivateKey?: boolean;
    hasApiSecret?: boolean;
    hasApiPassphrase?: boolean;
  };
  lastError?: string | null;
}

export interface ProviderConnectionTest {
  provider: Provider;
  status: ProviderStatus;
  health: {
    connected: boolean;
    degraded: boolean;
    rateLimited: boolean;
  };
  credentialsValid: { valid: boolean };
}

export interface ProviderFeeSnapshot {
  provider: Provider;
  syncedAt: string;
  raw: unknown;
}
