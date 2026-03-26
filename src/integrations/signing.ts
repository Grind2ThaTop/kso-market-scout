import { createHmac } from 'crypto';

export function signPolymarketL2(args: { timestamp: string; method: string; path: string; body?: string; secret: string }) {
  const payload = `${args.timestamp}${args.method.toUpperCase()}${args.path}${args.body ?? ''}`;
  return createHmac('sha256', args.secret).update(payload).digest('base64');
}
