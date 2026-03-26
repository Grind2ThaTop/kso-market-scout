import { IntegrationRecord, Provider, ProviderConnectionTest } from './types';

const API_BASE = import.meta.env.VITE_INTEGRATIONS_API_BASE ?? '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const integrationsApi = {
  list: async () => req<{ providers: { provider: Provider; integration: IntegrationRecord | null }[] }>(`/api/prediction-markets/providers`),
  saveCredentials: async (payload: {
    provider: Provider;
    enabled: boolean;
    environment?: 'prod' | 'demo';
    credentials: Record<string, string>;
  }) => req<{ integration: IntegrationRecord }>(`/api/prediction-markets/credentials/save`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  testCredentials: async (provider: Provider) => req<ProviderConnectionTest>(`/api/prediction-markets/credentials/test`, {
    method: 'POST',
    body: JSON.stringify({ provider }),
  }),
  syncAccount: async (provider: Provider) => req(`/api/prediction-markets/sync-account`, {
    method: 'POST',
    body: JSON.stringify({ provider }),
  }),
  markets: async (provider: Provider) => req(`/api/prediction-markets/markets?provider=${provider}`),
  positions: async (provider: Provider) => req(`/api/prediction-markets/positions?provider=${provider}`),
  orders: async (provider: Provider) => req(`/api/prediction-markets/orders?provider=${provider}`),
  placeOrder: async (provider: Provider, order: Record<string, unknown>) => req(`/api/prediction-markets/orders/place`, {
    method: 'POST',
    body: JSON.stringify({ provider, order }),
  }),
  cancelOrder: async (provider: Provider, orderId: string) => req(`/api/prediction-markets/orders/cancel`, {
    method: 'POST',
    body: JSON.stringify({ provider, orderId }),
  }),
  cancelAllOrders: async (provider: Provider) => req(`/api/prediction-markets/orders/cancel-all`, {
    method: 'POST',
    body: JSON.stringify({ provider }),
  }),
  realtimeInfo: async (provider: Provider) => req(`/api/prediction-markets/realtime?provider=${provider}`),
};
