import { constants, createSign } from 'node:crypto';
import { PredictionMarketProvider } from './base-provider.mjs';
import { ProviderError, AppErrorCode } from '../errors.mjs';
import { toNormalizedMarket } from '../models.mjs';

const ENV_URL = {
  prod: 'https://api.elections.kalshi.com/trade-api/v2',
  demo: 'https://demo-api.kalshi.co/trade-api/v2',
};

export class KalshiProvider extends PredictionMarketProvider {
  constructor({ environment = 'prod' } = {}) {
    super('kalshi', { rps: 7 });
    this.environment = environment === 'demo' ? 'demo' : 'prod';
    this.baseUrl = ENV_URL[this.environment];
  }

  buildHeaders(credentials, method, path, body = '') {
    if (!credentials?.apiKeyId || !credentials?.privateKeyPem) {
      throw new ProviderError(AppErrorCode.AUTH_FAILED, 'Kalshi credentials are missing API key ID or private key.');
    }
    const timestamp = `${Date.now()}`;
    const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
    const signer = createSign('RSA-SHA256');
    signer.update(payload);
    const signature = signer.sign({
      key: credentials.privateKeyPem,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    }).toString('base64');

    return {
      'KALSHI-ACCESS-KEY': credentials.apiKeyId,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
    };
  }

  async request(path, init = {}, credentials) {
    return this.call(async () => {
      const method = init.method ?? 'GET';
      const body = init.body ? JSON.stringify(init.body) : '';
      const headers = credentials
        ? { ...this.buildHeaders(credentials, method, path, body), ...(init.headers ?? {}) }
        : { ...(init.headers ?? {}) };
      const res = await fetch(`${this.baseUrl}${path}`, { method, headers, body: body || undefined });
      if (!res.ok) throw new Error(`Kalshi HTTP ${res.status}`);
      return res.json().catch(() => ({}));
    });
  }

  async listMarkets() {
    const rows = await this.request('/markets?limit=100&status=open');
    const markets = Array.isArray(rows?.markets) ? rows.markets : Array.isArray(rows) ? rows : [];
    return markets.map((row) => toNormalizedMarket(row, 'kalshi'));
  }

  async getMarketDetails(marketId) { return this.request(`/markets/${marketId}`); }
  async getEventDetails(eventTicker) { return this.request(`/events/${eventTicker}`); }
  async getOrderBook(marketTicker) { return this.request(`/markets/${marketTicker}/orderbook`); }
  async getRecentTrades(marketTicker) { return this.request(`/markets/${marketTicker}/trades?limit=50`); }

  async healthCheck() {
    try {
      await this.request('/markets?limit=1');
      return { connected: true, degraded: false, rateLimited: false };
    } catch (error) {
      const msg = String(error.message);
      return { connected: false, degraded: true, rateLimited: msg.includes('429') };
    }
  }

  async validateCredentials(credentials) {
    try {
      await this.request('/portfolio/balance', {}, credentials);
      return { valid: true };
    } catch {
      return { valid: false };
    }
  }

  async getBalances(credentials) { return this.request('/portfolio/balance', {}, credentials); }
  async getPositions(credentials) { return this.request('/portfolio/positions', {}, credentials); }
  async getOpenOrders(credentials) { return this.request('/portfolio/orders?status=open', {}, credentials); }
  async getFills(credentials) { return this.request('/portfolio/fills', {}, credentials); }
  async placeOrder(credentials, order) { return this.request('/portfolio/orders', { method: 'POST', body: order }, credentials); }
  async cancelOrder(credentials, orderId) { return this.request(`/portfolio/orders/${orderId}`, { method: 'DELETE' }, credentials); }
  async cancelAllOrders(credentials) { return this.request('/portfolio/orders', { method: 'DELETE' }, credentials); }
  async getFees() { return this.request('/series/fee_changes?limit=25'); }

  stream() {
    return {
      supported: true,
      transport: 'websocket',
      note: 'Kalshi websocket integration scaffolded; subscribe logic should be attached to authenticated market channels.',
    };
  }
}
