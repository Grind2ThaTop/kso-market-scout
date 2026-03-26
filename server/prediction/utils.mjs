import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AppErrorCode, ProviderError } from './errors.mjs';

export function cleanInput(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

export async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function redact(value = '') {
  if (!value) return null;
  if (value.length < 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function normalizePem(value) {
  const trimmed = cleanInput(value);
  if (!trimmed) return undefined;
  return trimmed.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

function deriveKey(masterKey) {
  return createHash('sha256').update(masterKey).digest();
}

export function encodeSecret(secret, masterKey, previousValue) {
  if (!secret) return previousValue;
  if (!masterKey) throw new Error('INTEGRATIONS_MASTER_KEY is required to store secrets.');
  const key = deriveKey(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    v: 1,
    enc: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decodeSecret(secretValue, masterKey) {
  if (!secretValue) return undefined;
  if (typeof secretValue === 'string') return secretValue;
  if (!masterKey) return undefined;
  if (!secretValue.enc || !secretValue.iv || !secretValue.tag) return undefined;
  const key = deriveKey(masterKey);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(secretValue.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(secretValue.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secretValue.enc, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export class CircuitBreaker {
  constructor({ failureThreshold = 4, cooldownMs = 30000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.failures = 0;
    this.openedAt = null;
  }
  assertClosed() {
    if (!this.openedAt) return;
    if (Date.now() - this.openedAt > this.cooldownMs) {
      this.failures = 0;
      this.openedAt = null;
      return;
    }
    throw new ProviderError(AppErrorCode.CIRCUIT_OPEN, 'Provider temporarily disabled after repeated failures.');
  }
  onSuccess() { this.failures = 0; this.openedAt = null; }
  onFailure() { this.failures += 1; if (this.failures >= this.failureThreshold) this.openedAt = Date.now(); }
}
export async function sleep(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }
export async function withBackoff(task, { attempts = 3, baseMs = 250, shouldRetry } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try { return await task(); } catch (error) {
      lastError = error;
      const retry = shouldRetry ? shouldRetry(error) : true;
      if (!retry || i === attempts - 1) throw error;
      await sleep(baseMs * (2 ** i));
    }
  }
  throw lastError;
}
export function createThrottler(rps = 8) {
  let last = 0;
  const minMs = 1000 / rps;
  return async function throttle() {
    const now = Date.now();
    const wait = Math.max(0, minMs - (now - last));
    if (wait) await sleep(wait);
    last = Date.now();
  };
}
export function safeLog(message, payload = {}) {
  const serialized = JSON.stringify(payload)
    .replace(/(secret|privateKey|passphrase|signature|authorization)"\s*:\s*"[^"]+"/gi, '$1":"***redacted***"');
  console.log(`[integrations] ${message} ${serialized}`);
}
