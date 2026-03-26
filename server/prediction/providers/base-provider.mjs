import { CircuitBreaker, createThrottler, withBackoff } from '../utils.mjs';
import { mapProviderError } from '../errors.mjs';

export class PredictionMarketProvider {
  constructor(providerName, opts = {}) {
    this.providerName = providerName;
    this.breaker = new CircuitBreaker(opts.circuitBreaker);
    this.throttle = createThrottler(opts.rps ?? 8);
  }

  async call(task, options = {}) {
    this.breaker.assertClosed();
    await this.throttle();

    try {
      const output = await withBackoff(task, {
        attempts: options.attempts ?? 2,
        shouldRetry: (error) => {
          const msg = String(error?.message ?? '').toLowerCase();
          if (msg.includes('401') || msg.includes('403') || msg.includes('signature')) return false;
          return msg.includes('429') || msg.includes('5');
        },
      });
      this.breaker.onSuccess();
      return output;
    } catch (error) {
      this.breaker.onFailure();
      throw mapProviderError(error);
    }
  }

  // interface surface
  async listMarkets() { throw new Error('not_implemented'); }
  async getMarketDetails() { throw new Error('not_implemented'); }
  async getEventDetails() { throw new Error('not_implemented'); }
  async getOrderBook() { throw new Error('not_implemented'); }
  async getRecentTrades() { throw new Error('not_implemented'); }
  async healthCheck() { throw new Error('not_implemented'); }
  async validateCredentials() { throw new Error('not_implemented'); }
  async getBalances() { throw new Error('not_implemented'); }
  async getPositions() { throw new Error('not_implemented'); }
  async getOpenOrders() { throw new Error('not_implemented'); }
  async getFills() { throw new Error('not_implemented'); }
  async placeOrder() { throw new Error('not_implemented'); }
  async cancelOrder() { throw new Error('not_implemented'); }
  async cancelAllOrders() { throw new Error('not_implemented'); }
  async getFees() { throw new Error('not_implemented'); }
  stream() { throw new Error('not_implemented'); }
}
