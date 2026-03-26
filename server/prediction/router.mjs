import { z } from 'zod';
import { KalshiProvider } from './providers/kalshi-provider.mjs';
import { PolymarketProvider } from './providers/polymarket-provider.mjs';
import { ProviderError } from './errors.mjs';
import { cleanInput, decodeSecret, encodeSecret, json, normalizePem, parseBody, redact, safeLog } from './utils.mjs';
import { toProviderStatus } from './models.mjs';

const providerSchema = z.enum(['polymarket', 'kalshi']);

const credentialSchema = z.object({
  provider: providerSchema,
  enabled: z.boolean().default(true),
  environment: z.enum(['prod', 'demo']).optional(),
  credentials: z.record(z.string(), z.string()).default({}),
});

const orderSchema = z.object({
  marketId: z.string().min(1),
  side: z.string().optional(),
  price: z.number().optional(),
  size: z.number().optional(),
  orderType: z.string().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

function getProvider(provider, environment) {
  return provider === 'kalshi' ? new KalshiProvider({ environment }) : new PolymarketProvider();
}

function readCredentialBlob(integration, masterKey) {
  const creds = integration?.credentials ?? {};
  return {
    ...creds,
    apiSecret: decodeSecret(creds.apiSecret, masterKey),
    apiPassphrase: decodeSecret(creds.apiPassphrase, masterKey),
  };
}

export function createRouter({ masterKey, readDb, writeDb }) {
  return async function route(req, res, pathname) {
    const db = await readDb();

    if (req.method === 'GET' && pathname === '/api/prediction-markets/providers') {
      const providers = ['kalshi', 'polymarket'].map((provider) => ({
        provider,
        integration: db.integrations[provider] ?? null,
        feeSnapshot: db.feeSnapshots[provider] ?? null,
      }));
      return json(res, 200, { providers });
    }

    if (req.method === 'POST' && pathname === '/api/prediction-markets/credentials/save') {
      const body = credentialSchema.parse(await parseBody(req));
      const now = new Date().toISOString();
      const current = db.integrations[body.provider] ?? { provider: body.provider, createdAt: now };
      const creds = body.credentials;

      const nextCredentials = body.provider === 'kalshi'
        ? {
            apiKeyId: cleanInput(creds.apiKeyId) ?? current.credentials?.apiKeyId,
            privateKeyPem: normalizePem(creds.privateKeyPem) ?? current.credentials?.privateKeyPem,
          }
        : {
            apiKey: cleanInput(creds.apiKey) ?? current.credentials?.apiKey,
            apiSecret: encodeSecret(cleanInput(creds.apiSecret), masterKey, current.credentials?.apiSecret),
            apiPassphrase: encodeSecret(cleanInput(creds.apiPassphrase), masterKey, current.credentials?.apiPassphrase),
            walletAddress: cleanInput(creds.walletAddress) ?? current.credentials?.walletAddress,
          };

      db.integrations[body.provider] = {
        ...current,
        provider: body.provider,
        enabled: body.enabled,
        environment: body.provider === 'kalshi' ? body.environment ?? 'prod' : 'prod',
        credentials: nextCredentials,
        credentialsMetadata: {
          apiKey_masked: redact(nextCredentials.apiKeyId ?? nextCredentials.apiKey),
          hasPrivateKey: Boolean(nextCredentials.privateKeyPem),
          hasApiSecret: Boolean(nextCredentials.apiSecret),
          hasApiPassphrase: Boolean(nextCredentials.apiPassphrase),
        },
        updatedAt: now,
      };
      await writeDb(db);
      return json(res, 200, { integration: { ...db.integrations[body.provider], credentials: undefined } });
    }

    if (req.method === 'POST' && pathname === '/api/prediction-markets/credentials/test') {
      const { provider } = z.object({ provider: providerSchema }).parse(await parseBody(req));
      const integration = db.integrations[provider];
      if (!integration) return json(res, 404, { error: 'integration_not_found' });

      const svc = getProvider(provider, integration.environment);
      const health = await svc.healthCheck();
      const credentialsValid = await svc.validateCredentials(readCredentialBlob(integration, masterKey));
      const status = toProviderStatus(provider, { credentialsValid: credentialsValid.valid }, health);

      db.integrations[provider] = {
        ...integration,
        status,
        lastTestedAt: new Date().toISOString(),
        credentialsValid: credentialsValid.valid,
        lastError: credentialsValid.valid ? null : 'Credentials invalid or incomplete.',
      };
      await writeDb(db);
      return json(res, 200, { provider, status, health, credentialsValid });
    }

    if (req.method === 'POST' && pathname === '/api/prediction-markets/sync-account') {
      const { provider } = z.object({ provider: providerSchema }).parse(await parseBody(req));
      const integration = db.integrations[provider];
      if (!integration) return json(res, 404, { error: 'integration_not_found' });
      const svc = getProvider(provider, integration.environment);
      const credentials = readCredentialBlob(integration, masterKey);
      const [balances, positions, orders, fills, fees] = await Promise.all([
        svc.getBalances(credentials),
        svc.getPositions(credentials),
        svc.getOpenOrders(credentials),
        svc.getFills(credentials),
        svc.getFees(credentials).catch(() => null),
      ]);
      db.feeSnapshots[provider] = fees ? { provider, syncedAt: new Date().toISOString(), raw: fees } : db.feeSnapshots[provider] ?? null;
      db.integrations[provider].lastSuccessfulSyncAt = new Date().toISOString();
      await writeDb(db);
      return json(res, 200, { provider, balances, positions, orders, fills, fees });
    }

    if (req.method === 'GET' && pathname === '/api/prediction-markets/markets') {
      const provider = providerSchema.parse(new URL(req.url, `http://${req.headers.host}`).searchParams.get('provider'));
      const integration = db.integrations[provider] ?? {};
      const svc = getProvider(provider, integration.environment);
      return json(res, 200, { provider, markets: await svc.listMarkets() });
    }

    if (req.method === 'GET' && pathname === '/api/prediction-markets/positions') {
      const provider = providerSchema.parse(new URL(req.url, `http://${req.headers.host}`).searchParams.get('provider'));
      const integration = db.integrations[provider];
      if (!integration) return json(res, 404, { error: 'integration_not_found' });
      const svc = getProvider(provider, integration.environment);
      return json(res, 200, { provider, positions: await svc.getPositions(readCredentialBlob(integration, masterKey)) });
    }

    if (req.method === 'GET' && pathname === '/api/prediction-markets/orders') {
      const provider = providerSchema.parse(new URL(req.url, `http://${req.headers.host}`).searchParams.get('provider'));
      const integration = db.integrations[provider];
      if (!integration) return json(res, 404, { error: 'integration_not_found' });
      const svc = getProvider(provider, integration.environment);
      return json(res, 200, { provider, orders: await svc.getOpenOrders(readCredentialBlob(integration, masterKey)) });
    }

    if (req.method === 'POST' && pathname === '/api/prediction-markets/orders/place') {
      const payload = z.object({ provider: providerSchema, order: orderSchema }).parse(await parseBody(req));
      const integration = db.integrations[payload.provider];
      if (!integration) return json(res, 404, { error: 'integration_not_found' });
      const svc = getProvider(payload.provider, integration.environment);
      const order = payload.order.raw ?? payload.order;
      const result = await svc.placeOrder(readCredentialBlob(integration, masterKey), order);
      return json(res, 200, { provider: payload.provider, order: result });
    }

    if (req.method === 'POST' && pathname === '/api/prediction-markets/orders/cancel') {
      const payload = z.object({ provider: providerSchema, orderId: z.string() }).parse(await parseBody(req));
      const integration = db.integrations[payload.provider];
      if (!integration) return json(res, 404, { error: 'integration_not_found' });
      const svc = getProvider(payload.provider, integration.environment);
      const result = await svc.cancelOrder(readCredentialBlob(integration, masterKey), payload.orderId);
      return json(res, 200, { provider: payload.provider, result });
    }

    if (req.method === 'POST' && pathname === '/api/prediction-markets/orders/cancel-all') {
      const payload = z.object({ provider: providerSchema }).parse(await parseBody(req));
      const integration = db.integrations[payload.provider];
      if (!integration) return json(res, 404, { error: 'integration_not_found' });
      const svc = getProvider(payload.provider, integration.environment);
      const result = await svc.cancelAllOrders(readCredentialBlob(integration, masterKey));
      return json(res, 200, { provider: payload.provider, result });
    }

    if (req.method === 'GET' && pathname === '/api/prediction-markets/realtime') {
      const provider = providerSchema.parse(new URL(req.url, `http://${req.headers.host}`).searchParams.get('provider'));
      const integration = db.integrations[provider] ?? {};
      const svc = getProvider(provider, integration.environment);
      return json(res, 200, { provider, realtime: svc.stream() });
    }

    return false;
  };
}

export function handleRouteError(res, error) {
  if (error instanceof z.ZodError) {
    return json(res, 400, { error: 'bad_request', details: error.issues });
  }
  if (error instanceof ProviderError) {
    safeLog('provider_error', { code: error.code, message: error.message });
    return json(res, 502, { error: error.code, message: error.message });
  }
  safeLog('server_error', { message: String(error?.message ?? error) });
  return json(res, 500, { error: 'server_error', message: String(error?.message ?? error) });
}
