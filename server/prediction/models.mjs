export function toNormalizedMarket(row, provider) {
  return {
    id: String(row.id ?? row.ticker ?? row.conditionId ?? row.market ?? 'unknown'),
    provider,
    title: String(row.title ?? row.question ?? row.name ?? 'Untitled'),
    status: String(row.status ?? row.active ?? 'unknown'),
    closesAt: row.close_time ?? row.endDate ?? row.end_date ?? null,
    raw: row,
  };
}

export function toProviderStatus(provider, integration, health) {
  if (health.rateLimited) return 'rate-limited';
  if (health.degraded) return 'degraded';
  if (health.connected && integration?.credentialsValid) return 'connected';
  if (health.connected) return 'degraded';
  if (integration?.credentialsValid === false) return 'invalid';
  return 'disconnected';
}
