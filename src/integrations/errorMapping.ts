export type AppErrorCode =
  | 'auth_failed'
  | 'invalid_signature'
  | 'rate_limited'
  | 'insufficient_balance'
  | 'market_closed'
  | 'bad_request'
  | 'unsupported_operation'
  | 'websocket_disconnected'
  | 'upstream_error';

export function mapProviderMessageToErrorCode(message: string): AppErrorCode {
  const msg = message.toLowerCase();
  if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) return 'auth_failed';
  if (msg.includes('signature')) return 'invalid_signature';
  if (msg.includes('429') || msg.includes('rate')) return 'rate_limited';
  if (msg.includes('insufficient')) return 'insufficient_balance';
  if (msg.includes('market closed') || msg.includes('closed')) return 'market_closed';
  if (msg.includes('400')) return 'bad_request';
  return 'upstream_error';
}
