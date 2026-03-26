import http from 'node:http';
import { constants, createHash, randomBytes, createSign } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.INTEGRATIONS_PORT ?? 8787);
const DATA_FILE = path.resolve('server/data/integrations.json');
const MASTER_KEY = process.env.INTEGRATIONS_MASTER_KEY
  ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-master-key');

const defaultCaps = {
  polymarket: {
    provider: 'polymarket',
    supports_public_market_data: true,
    supports_authenticated_trading: true,
    supports_fee_sync: true,
    supports_demo: false,
    supports_websocket: true,
    notes: 'Public CLOB market data is available without credentials. Trading requires L1/L2 auth setup.',
  },
  kalshi: {
    provider: 'kalshi',
    supports_public_market_data: true,
    supports_authenticated_trading: true,
    supports_fee_sync: true,
    supports_demo: true,
    supports_websocket: true,
    notes: 'Authenticated endpoints require RSA-PSS signatures with API key id + private key.',
  },
};

const environments = {
  polymarket: { prod: 'https://clob.polymarket.com' },
  kalshi: { prod: 'https://api.elections.kalshi.com/trade-api/v2', demo: 'https://demo-api.kalshi.co/trade-api/v2' },
};

const SUPPORTED_ENVS = {
  polymarket: new Set(['prod']),
  kalshi: new Set(['prod', 'demo']),
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(body));
}

function mask(value = '') {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function cleanInput(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizePem(value) {
  const trimmed = cleanInput(value);
  if (!trimmed) return undefined;
  return trimmed.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

function readCredential(integration, field) {
  if (!integration) return undefined;
  return integration[field] ?? integration.credentials?.[field];
}

function encryptSecret(secret) {
  if (!MASTER_KEY) throw new Error('INTEGRATIONS_MASTER_KEY is required to save credentials.');
  const iv = randomBytes(16);
  const key = createHash('sha256').update(MASTER_KEY).digest();
  const cipher = createHash('sha256').update(Buffer.concat([key, iv, Buffer.from(secret)])).digest('hex');
  return { cipher, iv: iv.toString('hex') };
}

function encodeSecret(secret, previousValue) {
  if (!secret) return previousValue;
  if (MASTER_KEY) return encryptSecret(secret);
  return { plain: secret };
}

async function readDb() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { integrations: {}, feeSnapshots: {}, capabilities: defaultCaps };
  }
}

async function writeDb(db) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function testPolymarket(integration) {
  const base = environments.polymarket.prod;
  const out = { provider: 'polymarket', publicMarketData: false, authenticated: false, feeEndpoint: false, tradingEnabled: false, errors: [] };
  const apiKeyId = readCredential(integration, 'apiKeyId');
  try {
    const pub = await fetch(`${base}/markets?limit=1`);
    out.publicMarketData = pub.ok;
    if (!pub.ok) out.errors.push(`public_market_data_http_${pub.status}`);
  } catch (e) { out.errors.push(`public_market_data_network_${e.message}`); }

  try {
    const fee = await fetch(`${base}/fee-rate`, { headers: apiKeyId ? { POLY_API_KEY: apiKeyId } : {} });
    out.feeEndpoint = fee.ok;
    if (!fee.ok) out.errors.push(`fee_http_${fee.status}`);
  } catch (e) { out.errors.push(`fee_network_${e.message}`); }

  // Authenticated trading test requires full Polymarket CLOB L2 signing flow; until
  // that request succeeds against an authenticated endpoint, remain disabled.
  return out;
}

function buildKalshiRequestPath(pathWithQuery) {
  const trimmed = cleanInput(pathWithQuery) ?? '/';
  if (trimmed.startsWith('/trade-api/')) return trimmed;
  return `/trade-api/v2${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function kalshiHeaders(keyId, privateKeyPem, pathWithQuery) {
  const timestamp = `${Date.now()}`;
  const requestPath = buildKalshiRequestPath(pathWithQuery);
  const msg = `${timestamp}GET${requestPath}`;
  const sign = createSign('RSA-SHA256');
  sign.update(msg);
  const signature = sign.sign({
    key: privateKeyPem,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString('base64');
  return { 'KALSHI-ACCESS-KEY': keyId, 'KALSHI-ACCESS-SIGNATURE': signature, 'KALSHI-ACCESS-TIMESTAMP': timestamp };
}

async function testKalshi(integration) {
  const env = integration.environment === 'demo' ? 'demo' : 'prod';
  const base = environments.kalshi[env];
  const out = { provider: 'kalshi', publicMarketData: false, authenticated: false, feeEndpoint: false, tradingEnabled: false, errors: [] };
  const apiKeyId = readCredential(integration, 'apiKeyId');
  const privateKeyPem = readCredential(integration, 'privateKeyPem');

  try {
    const pub = await fetch(`${base}/markets?limit=1`);
    out.publicMarketData = pub.ok;
    if (!pub.ok) out.errors.push(`public_market_data_http_${pub.status}`);
  } catch (e) { out.errors.push(`public_market_data_network_${e.message}`); }

  if (apiKeyId && privateKeyPem) {
    try {
      const h = kalshiHeaders(apiKeyId, privateKeyPem, '/portfolio/balance');
      const auth = await fetch(`${base}/portfolio/balance`, { headers: h });
      out.authenticated = auth.ok;
      out.tradingEnabled = auth.ok;
      if (!auth.ok) {
        const body = await auth.text().catch(() => '');
        const reason = cleanInput(body)?.slice(0, 200);
        out.errors.push(`auth_http_${auth.status}${reason ? `_${reason}` : ''}`);
      }
    } catch (e) { out.errors.push(`auth_signature_${e.message}`); }
  }

  try {
    const fee = await fetch(`${base}/series/fee_changes?limit=5`);
    out.feeEndpoint = fee.ok;
    if (!fee.ok) out.errors.push(`fee_http_${fee.status}`);
  } catch (e) { out.errors.push(`fee_network_${e.message}`); }

  return out;
}

async function syncFees(provider, integration) {
  if (provider === 'polymarket') {
    const apiKeyId = readCredential(integration, 'apiKeyId');
    const res = await fetch('https://clob.polymarket.com/fee-rate', { headers: apiKeyId ? { POLY_API_KEY: apiKeyId } : {} });
    const raw = await res.json().catch(() => ({}));
    return {
      provider,
      maker_fee: Number(raw.makerFeeRate ?? raw.maker_fee_rate ?? 0),
      taker_fee: Number(raw.takerFeeRate ?? raw.taker_fee_rate ?? 0),
      base_fee: null,
      fee_notes: 'Polymarket fee-rate endpoint.',
      fee_source: 'https://clob.polymarket.com/fee-rate',
      raw_payload: raw,
      synced_at: new Date().toISOString(),
    };
  }
  const env = integration?.environment === 'demo' ? 'demo' : 'prod';
  const base = environments.kalshi[env];
  const res = await fetch(`${base}/series/fee_changes?limit=10`);
  const raw = await res.json().catch(() => ({}));
  return {
    provider,
    maker_fee: null,
    taker_fee: null,
    base_fee: null,
    fee_notes: 'Kalshi publishes fee changes and rounding semantics at series level; raw payload preserved.',
    fee_source: `${base}/series/fee_changes?limit=10`,
    raw_payload: raw,
    synced_at: new Date().toISOString(),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathName = url.pathname;
  const db = await readDb();

  try {
    if (req.method === 'GET' && pathName === '/api/integrations') {
      return json(res, 200, {
        integrations: Object.values(db.integrations ?? {}).map((x) => ({ ...x, credentials: undefined })),
        capabilities: db.capabilities,
      });
    }

    const connectMatch = pathName.match(/^\/api\/integrations\/(polymarket|kalshi)\/connect$/);
    if (req.method === 'POST' && connectMatch) {
      const provider = connectMatch[1];
      const body = await parseBody(req);
      const now = new Date().toISOString();
      const current = db.integrations[provider] ?? { provider, createdAt: now };
      const requestedEnv = cleanInput(body.environment) ?? 'prod';
      const environment = SUPPORTED_ENVS[provider].has(requestedEnv) ? requestedEnv : 'prod';
      const apiKeyId = cleanInput(body.apiKeyId) ?? current.credentials?.apiKeyId;
      const apiSecret = cleanInput(body.apiSecret);
      const apiPassphrase = cleanInput(body.apiPassphrase);
      const walletPrivateKey = cleanInput(body.walletPrivateKey);
      const privateKeyPem = normalizePem(body.privateKeyPem) ?? current.credentials?.privateKeyPem;

      const next = {
        ...current,
        provider,
        environment,
        status: 'disconnected',
        last_error: null,
        market_data_enabled: true,
        updatedAt: now,
        credentials_metadata: {
          apiKeyId_masked: mask(apiKeyId),
          hasPrivateKey: Boolean(privateKeyPem || walletPrivateKey || current.credentials?.walletPrivateKey),
          hasApiSecret: Boolean(apiSecret || current.credentials?.apiSecret),
          hasApiPassphrase: Boolean(apiPassphrase || current.credentials?.apiPassphrase),
        },
        credentials: {
          apiKeyId,
          apiSecret: encodeSecret(apiSecret, current.credentials?.apiSecret),
          apiPassphrase: encodeSecret(apiPassphrase, current.credentials?.apiPassphrase),
          privateKeyPem,
          walletPrivateKey: encodeSecret(walletPrivateKey, current.credentials?.walletPrivateKey),
        },
      };
      const test = provider === 'polymarket'
        ? await testPolymarket(next)
        : await testKalshi(next);
      next.status = test.publicMarketData && (test.authenticated || provider === 'polymarket') ? 'connected' : 'disconnected';
      next.trading_enabled = test.tradingEnabled;
      next.fee_sync_enabled = test.feeEndpoint;
      next.last_tested_at = now;
      next.last_successful_connection_at = test.publicMarketData ? now : current.last_successful_connection_at ?? null;
      if (test.errors.length) next.last_error = test.errors.join('; ');
      db.integrations[provider] = next;
      await writeDb(db);
      return json(res, 200, { provider, status: next.status, test, integration: { ...next, credentials: undefined } });
    }

    const testMatch = pathName.match(/^\/api\/integrations\/(polymarket|kalshi)\/test$/);
    if (req.method === 'POST' && testMatch) {
      const provider = testMatch[1];
      const integ = db.integrations[provider];
      if (!integ) return json(res, 404, { error: 'integration_not_found' });
      const test = provider === 'polymarket' ? await testPolymarket(integ) : await testKalshi(integ);
      if (!(test.publicMarketData && (provider === 'polymarket' || test.authenticated))) {
        db.integrations[provider].status = 'disconnected';
      }
      db.integrations[provider].last_tested_at = new Date().toISOString();
      db.integrations[provider].last_error = test.errors.join('; ') || null;
      await writeDb(db);
      return json(res, 200, { provider, test });
    }

    const feeMatch = pathName.match(/^\/api\/integrations\/(polymarket|kalshi)\/sync-fees$/);
    if (req.method === 'POST' && feeMatch) {
      const provider = feeMatch[1];
      const integ = db.integrations[provider] ?? null;
      const snapshot = await syncFees(provider, integ);
      db.feeSnapshots[provider] = snapshot;
      if (db.integrations[provider]) db.integrations[provider].last_fee_sync_at = snapshot.synced_at;
      await writeDb(db);
      return json(res, 200, snapshot);
    }

    const statusMatch = pathName.match(/^\/api\/integrations\/(polymarket|kalshi)\/status$/);
    if (req.method === 'GET' && statusMatch) {
      const provider = statusMatch[1];
      const integ = db.integrations[provider];
      if (!integ) return json(res, 404, { error: 'integration_not_found' });
      return json(res, 200, { ...integ, credentials: undefined, feeSnapshot: db.feeSnapshots[provider] ?? null });
    }

    const feesMatch = pathName.match(/^\/api\/integrations\/(polymarket|kalshi)\/fees$/);
    if (req.method === 'GET' && feesMatch) {
      const provider = feesMatch[1];
      return json(res, 200, db.feeSnapshots[provider] ?? null);
    }

    const delMatch = pathName.match(/^\/api\/integrations\/(polymarket|kalshi)$/);
    if (req.method === 'DELETE' && delMatch) {
      const provider = delMatch[1];
      delete db.integrations[provider];
      delete db.feeSnapshots[provider];
      await writeDb(db);
      return json(res, 200, { deleted: provider });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    return json(res, 500, { error: 'server_error', message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Integrations API listening on :${PORT}`);
});
