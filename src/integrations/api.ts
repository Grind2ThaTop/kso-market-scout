import { FeeSnapshot, IntegrationRecord, Provider, TestResult } from './types';

const API_BASE = import.meta.env.VITE_INTEGRATIONS_API_BASE ?? '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const integrationsApi = {
  list: async () => req<{ integrations: IntegrationRecord[] }>(`/api/integrations`),
  connect: async (provider: Provider, payload: Record<string, string>) =>
    req<{ integration: IntegrationRecord; test: TestResult }>(`/api/integrations/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  test: async (provider: Provider) =>
    req<{ provider: Provider; test: TestResult }>(`/api/integrations/${provider}/test`, { method: 'POST' }),
  syncFees: async (provider: Provider) =>
    req<FeeSnapshot>(`/api/integrations/${provider}/sync-fees`, { method: 'POST' }),
  status: async (provider: Provider) => req<IntegrationRecord>(`/api/integrations/${provider}/status`),
  fees: async (provider: Provider) => req<FeeSnapshot | null>(`/api/integrations/${provider}/fees`),
  remove: async (provider: Provider) => req(`/api/integrations/${provider}`, { method: 'DELETE' }),
};
