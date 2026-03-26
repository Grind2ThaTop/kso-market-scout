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
  const credentialsValid = integration?.credentialsValid;

  if (credentialsValid === false) return 'invalid';
  if (health.rateLimited) return 'rate-limited';

  if (!health.connected) {
    return health.degraded ? 'degraded' : 'disconnected';
  }

  if (health.degraded) return 'degraded';
  if (credentialsValid === true) return 'connected';

  // Public connectivity is healthy but auth has not been validated yet.
  return provider === 'polymarket' ? 'degraded' : 'disconnected';
}
