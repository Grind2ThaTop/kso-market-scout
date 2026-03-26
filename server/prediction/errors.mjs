export class ProviderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.details = details;
  }
}

export const AppErrorCode = {
  AUTH_FAILED: 'auth_failed',
  INVALID_SIGNATURE: 'invalid_signature',
  RATE_LIMITED: 'rate_limited',
  INSUFFICIENT_BALANCE: 'insufficient_balance',
  MARKET_CLOSED: 'market_closed',
  BAD_REQUEST: 'bad_request',
  UNSUPPORTED_OPERATION: 'unsupported_operation',
  WEBSOCKET_DISCONNECTED: 'websocket_disconnected',
  CIRCUIT_OPEN: 'circuit_open',
  UPSTREAM_ERROR: 'upstream_error',
};

export function mapProviderError(error) {
  if (error instanceof ProviderError) return error;
  const msg = String(error?.message ?? error).toLowerCase();
  if (msg.includes('429') || msg.includes('rate')) return new ProviderError(AppErrorCode.RATE_LIMITED, 'Provider rate limited request.');
  if (msg.includes('signature')) return new ProviderError(AppErrorCode.INVALID_SIGNATURE, 'Request signature was rejected.');
  if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) return new ProviderError(AppErrorCode.AUTH_FAILED, 'Credentials were rejected.');
  if (msg.includes('insufficient')) return new ProviderError(AppErrorCode.INSUFFICIENT_BALANCE, 'Insufficient balance.');
  if (msg.includes('closed')) return new ProviderError(AppErrorCode.MARKET_CLOSED, 'Market is closed.');
  if (msg.includes('400')) return new ProviderError(AppErrorCode.BAD_REQUEST, 'Request parameters are invalid.');
  return new ProviderError(AppErrorCode.UPSTREAM_ERROR, 'Provider request failed.');
}
