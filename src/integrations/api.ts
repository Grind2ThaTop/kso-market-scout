import { IntegrationRecord, Provider, ProviderConnectionTest, ProviderStatus } from './types';

// Local storage keys
const STORAGE_KEY = 'kso_integrations';

interface StoredIntegration {
  provider: Provider;
  enabled: boolean;
  environment: 'prod' | 'demo';
  credentials: Record<string, string>;
  status: ProviderStatus;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
}

function loadIntegrations(): StoredIntegration[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIntegrations(integrations: StoredIntegration[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(integrations));
}

function findOrCreate(provider: Provider): StoredIntegration {
  const all = loadIntegrations();
  const existing = all.find((i) => i.provider === provider);
  return existing ?? {
    provider,
    enabled: false,
    environment: 'prod',
    credentials: {},
    status: 'disconnected',
    lastSuccessfulSyncAt: null,
    lastError: null,
  };
}

function toRecord(s: StoredIntegration): IntegrationRecord {
  return {
    provider: s.provider,
    enabled: s.enabled,
    environment: s.environment,
    status: s.status,
    lastSuccessfulSyncAt: s.lastSuccessfulSyncAt,
    lastError: s.lastError,
  };
}

// Simulate async delay
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export const integrationsApi = {
  list: async () => {
    await delay();
    const stored = loadIntegrations();
    const providers: Provider[] = ['kalshi', 'polymarket'];
    return {
      providers: providers.map((p) => {
        const s = stored.find((i) => i.provider === p);
        return { provider: p, integration: s ? toRecord(s) : null };
      }),
    };
  },

  saveCredentials: async (payload: {
    provider: Provider;
    enabled: boolean;
    environment?: 'prod' | 'demo';
    credentials: Record<string, string>;
  }) => {
    await delay(500);
    const all = loadIntegrations();
    const idx = all.findIndex((i) => i.provider === payload.provider);
    const hasCredentials = Object.values(payload.credentials).some((v) => v.trim().length > 0);
    const entry: StoredIntegration = {
      provider: payload.provider,
      enabled: payload.enabled,
      environment: payload.environment ?? 'prod',
      credentials: payload.credentials,
      status: hasCredentials ? 'disconnected' : 'disconnected',
      lastSuccessfulSyncAt: null,
      lastError: null,
    };
    if (idx >= 0) all[idx] = entry;
    else all.push(entry);
    saveIntegrations(all);
    return { integration: toRecord(entry) };
  },

  testCredentials: async (provider: Provider): Promise<ProviderConnectionTest> => {
    await delay(800);
    const entry = findOrCreate(provider);
    const hasCredentials = Object.values(entry.credentials).some((v) => v.trim().length > 0);

    if (!hasCredentials) {
      return { provider, status: 'invalid' as ProviderStatus, health: { connected: false, degraded: false, rateLimited: false }, credentialsValid: { valid: false } };
    }

    // Simulate a successful demo connection test
    const all = loadIntegrations();
    const idx = all.findIndex((i) => i.provider === provider);
    if (idx >= 0) {
      all[idx].status = 'connected';
      all[idx].lastSuccessfulSyncAt = new Date().toISOString();
      all[idx].lastError = null;
      saveIntegrations(all);
    }

    return { provider, status: 'connected' as ProviderStatus, health: { connected: true, degraded: false, rateLimited: false }, credentialsValid: { valid: true } };
  },

  syncAccount: async (provider: Provider) => {
    await delay(1000);
    const entry = findOrCreate(provider);
    const hasCredentials = Object.values(entry.credentials).some((v) => v.trim().length > 0);
    if (!hasCredentials) throw new Error('No credentials configured. Save credentials before syncing.');

    const all = loadIntegrations();
    const idx = all.findIndex((i) => i.provider === provider);
    if (idx >= 0) {
      all[idx].lastSuccessfulSyncAt = new Date().toISOString();
      saveIntegrations(all);
    }
    return { synced: true, message: 'Account sync complete (demo mode).' };
  },

  markets: async (_provider: Provider) => {
    await delay();
    return { markets: [] };
  },
  positions: async (_provider: Provider) => {
    await delay();
    return { positions: [] };
  },
  orders: async (_provider: Provider) => {
    await delay();
    return { orders: [] };
  },
  placeOrder: async (_provider: Provider, _order: Record<string, unknown>) => {
    await delay();
    return { message: 'Paper order placed (demo mode).' };
  },
  cancelOrder: async (_provider: Provider, _orderId: string) => {
    await delay();
    return { message: 'Order cancelled (demo mode).' };
  },
  cancelAllOrders: async (_provider: Provider) => {
    await delay();
    return { message: 'All orders cancelled (demo mode).' };
  },
  realtimeInfo: async (_provider: Provider) => {
    await delay();
    return { realtime: { supported: false, note: 'Realtime not available in demo mode.' } };
  },
};
