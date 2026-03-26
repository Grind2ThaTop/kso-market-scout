export type Provider = 'polymarket' | 'kalshi';

export interface IntegrationRecord {
  provider: Provider;
  status: 'connected' | 'disconnected';
  environment: string;
  trading_enabled: boolean;
  market_data_enabled: boolean;
  fee_sync_enabled: boolean;
  last_tested_at?: string;
  last_fee_sync_at?: string;
  last_successful_connection_at?: string;
  last_error?: string | null;
  credentials_metadata?: {
    apiKeyId_masked?: string | null;
    hasPrivateKey?: boolean;
    hasApiSecret?: boolean;
    hasApiPassphrase?: boolean;
  };
}

export interface FeeSnapshot {
  provider: Provider;
  maker_fee: number | null;
  taker_fee: number | null;
  base_fee: number | null;
  fee_notes: string;
  fee_source: string;
  synced_at: string;
  raw_payload: unknown;
}

export interface TestResult {
  provider: Provider;
  publicMarketData: boolean;
  authenticated: boolean;
  feeEndpoint: boolean;
  tradingEnabled: boolean;
  errors: string[];
}
