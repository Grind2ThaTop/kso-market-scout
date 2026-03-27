import { createHmac } from 'node:crypto';
import { PredictionMarketProvider } from './base-provider.mjs';
import { toNormalizedMarket } from '../models.mjs';
import { AppErrorCode, ProviderError } from '../errors.mjs';

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';

export class PolymarketProvider extends PredictionMarketProvider {
  constructor() {
    super('polymarket', { rps: 12 });
  }

  signL2({ method, path, body = '', timestamp, secret }) {
    const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
    return createHmac('sha256', secret).update(payload).digest('base64');
  }

  buildL2Headers(credentials, method, path, body = '') {
    if (!credentials?.apiKey || !credentials?.apiSecret || !credentials?.apiPassphrase) {
      throw new ProviderError(AppErrorCode.AUTH_FAILED, 'Polymarket L2 credentials are required for trading requests.');
    }
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const signature = this.signL2({ method, path, body, timestamp, secret: credentials.apiSecret });
    return {
      POLY_API_KEY: credentials.apiKey,
      POLY_PASSPHRASE: credentials.apiPassphrase,
      POLY_TIMESTAMP: timestamp,
      POLY_SIGNATURE: signature,
      'Content-Type': 'application/json',
    };
  }

  async gamma(path) {
    return this.call(async () => {
      const res = await fetch(`${GAMMA}${path}`);
      if (!res.ok) throw new Error(`Polymarket gamma HTTP ${res.status}`);
      return res.json();
    });
  }

  async clob(path, init = {}, credentials) {
    return this.call(async () => {
      const method = init.method ?? 'GET';
      const body = init.body ? JSON.stringify(init.body) : '';
      const headers = credentials
        ? { ...this.buildL2Headers(credentials, method, path, body), ...(init.headers ?? {}) }
        : { ...(init.headers ?? {}) };
      const res = await fetch(`${CLOB}${path}`, { method, headers, body: body || undefined });
      if (!res.ok) throw new Error(`Polymarket clob HTTP ${res.status}`);
      return res.json().catch(() => ({}));
    });
  }

  async listMarkets() {
    const rows = await this.gamma('/markets?limit=100&active=true&closed=false&archived=false');
    const markets = Array.isArray(rows) ? rows : rows?.data ?? [];
    return markets.map((row) => toNormalizedMarket(row, 'polymarket'));
  }

  async getMarketDetails(marketId) { return this.gamma(`/markets/${marketId}`); }
  async getEventDetails(eventId) { return this.gamma(`/events/${eventId}`); }
  async getOrderBook(marketId) { return this.clob(`/book?market=${encodeURIComponent(marketId)}`); }
  async getRecentTrades(marketId) { return this.clob(`/trades?market=${encodeURIComponent(marketId)}&limit=50`); }

  async healthCheck() {
    try {
      await this.gamma('/markets?limit=1');
      return { connected: true, degraded: false, rateLimited: false };
    } catch (error) {
      const msg = String(error.message);
      return { connected: false, degraded: true, rateLimited: msg.includes('429') };
    }
  }

  async validateCredentials(credentials) {
    try {
      await this.clob('/auth/access-status', {}, credentials);
      return { valid: true };
    } catch {
      return { valid: false };
    }
  }

  async getBalances(credentials) { return this.clob('/balance', {}, credentials); }
  async getPositions(credentials) { return this.clob('/positions', {}, credentials); }
  async getOpenOrders(credentials) { return this.clob('/orders?status=open', {}, credentials); }
  async getFills(credentials) { return this.clob('/trades?limit=200', {}, credentials); }
  async placeOrder(credentials, order) { return this.clob('/order', { method: 'POST', body: order }, credentials); }
  async cancelOrder(credentials, orderId) { return this.clob('/order', { method: 'DELETE', body: { orderID: orderId } }, credentials); }
  async cancelAllOrders(credentials) { return this.clob('/cancel-all', { method: 'DELETE' }, credentials); }
  async getFees(credentials) { return this.clob('/fee-rate', {}, credentials); }

  stream() {
    return {
      supported: true,
      transport: 'websocket',
      note: 'Polymarket websocket scaffolding is available. Integrate authenticated user channels using L2 credentials.',
    };
  }
}
