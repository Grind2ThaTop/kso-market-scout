import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Link2, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { integrationsApi } from '@/integrations/api';
import { Provider } from '@/integrations/types';
import { useToast } from '@/hooks/use-toast';

const PROVIDERS: { id: Provider; title: string; description: string; envs: string[] }[] = [
  {
    id: 'polymarket',
    title: 'Polymarket',
    description: 'Public CLOB market data works without credentials. Trading remains disabled until auth credentials pass test.',
    envs: ['prod'],
  },
  {
    id: 'kalshi',
    title: 'Kalshi',
    description: 'Authenticated access uses API Key ID + RSA private key signed headers.',
    envs: ['prod', 'demo'],
  },
];

const SettingsPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [forms, setForms] = useState<Record<Provider, Record<string, string>>>({
    polymarket: { environment: 'prod', apiKeyId: '', apiSecret: '', apiPassphrase: '', walletPrivateKey: '' },
    kalshi: { environment: 'prod', apiKeyId: '', privateKeyPem: '' },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationsApi.list,
  });

  const integrationByProvider = useMemo(() => {
    const map = new Map<Provider, {
      provider: Provider;
      status: 'connected' | 'disconnected';
      environment: string;
      trading_enabled: boolean;
      market_data_enabled: boolean;
      fee_sync_enabled: boolean;
      last_tested_at?: string;
      last_fee_sync_at?: string;
      last_successful_connection_at?: string;
      last_error?: string | null;
      credentials_metadata?: { apiKeyId_masked?: string | null };
    }>();
    for (const row of data?.integrations ?? []) map.set(row.provider, row);
    return map;
  }, [data]);

  const connect = useMutation({
    mutationFn: ({ provider }: { provider: Provider }) => integrationsApi.connect(provider, forms[provider]),
    onSuccess: (_, variables) => {
      toast({ title: `${variables.provider} saved`, description: 'Credentials stored server-side and test executed.' });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error: Error) => toast({ title: 'Save failed', description: error.message, variant: 'destructive' }),
  });

  const testConnection = useMutation({
    mutationFn: (provider: Provider) => integrationsApi.test(provider),
    onSuccess: (result) => {
      toast({ title: `${result.provider} test complete`, description: result.test.errors.length ? result.test.errors.join(', ') : 'All checks passed.' });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error: Error) => toast({ title: 'Test failed', description: error.message, variant: 'destructive' }),
  });

  const syncFees = useMutation({
    mutationFn: (provider: Provider) => integrationsApi.syncFees(provider),
    onSuccess: (snapshot) => {
      toast({ title: `${snapshot.provider} fees synced`, description: `Synced at ${new Date(snapshot.synced_at).toLocaleString()}` });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error: Error) => toast({ title: 'Fee sync failed', description: error.message, variant: 'destructive' }),
  });

  const disconnect = useMutation({
    mutationFn: (provider: Provider) => integrationsApi.remove(provider),
    onSuccess: () => {
      toast({ title: 'Integration removed' });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-primary" /> Integrations / API Keys
      </h1>
      <p className="text-xs text-muted-foreground">Goal: one serious settings panel for Polymarket + Kalshi with real connection tests and fee sync.</p>

      {isLoading ? <div className="text-sm text-muted-foreground">Loading integrations…</div> : null}

      <div className="grid grid-cols-1 gap-4">
        {PROVIDERS.map((provider) => {
          const current = integrationByProvider.get(provider.id);
          const form = forms[provider.id];
          return (
            <div key={provider.id} className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" />{provider.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${current?.status === 'connected' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'}`}>{current?.status ?? 'disconnected'}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <StatusRow label="Trading enabled" value={current?.trading_enabled ? 'yes' : 'no'} />
                <StatusRow label="Market data enabled" value={current?.market_data_enabled ? 'yes' : 'no'} />
                <StatusRow label="Fee sync enabled" value={current?.fee_sync_enabled ? 'yes' : 'no'} />
                <StatusRow label="Last successful connection" value={current?.last_successful_connection_at ? new Date(current.last_successful_connection_at).toLocaleString() : 'N/A'} />
                <StatusRow label="Last fee sync" value={current?.last_fee_sync_at ? new Date(current.last_fee_sync_at).toLocaleString() : 'N/A'} />
                <StatusRow label="Masked key" value={current?.credentials_metadata?.apiKeyId_masked ?? 'N/A'} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">Environment
                  <select className="mt-1 w-full bg-surface-2 border border-border rounded px-2 py-2 text-foreground" value={form.environment} onChange={(e) => setForms((prev) => ({ ...prev, [provider.id]: { ...prev[provider.id], environment: e.target.value } }))}>
                    {provider.envs.map((env) => <option key={env} value={env}>{env}</option>)}
                  </select>
                </label>

                <label className="text-xs text-muted-foreground">API Key ID
                  <input className="mt-1 w-full bg-surface-2 border border-border rounded px-2 py-2 text-foreground" value={form.apiKeyId ?? ''} onChange={(e) => setForms((prev) => ({ ...prev, [provider.id]: { ...prev[provider.id], apiKeyId: e.target.value } }))} />
                </label>

                {provider.id === 'polymarket' ? (
                  <>
                    <label className="text-xs text-muted-foreground">API Secret
                      <input type="password" className="mt-1 w-full bg-surface-2 border border-border rounded px-2 py-2 text-foreground" value={form.apiSecret ?? ''} onChange={(e) => setForms((prev) => ({ ...prev, polymarket: { ...prev.polymarket, apiSecret: e.target.value } }))} />
                    </label>
                    <label className="text-xs text-muted-foreground">API Passphrase
                      <input type="password" className="mt-1 w-full bg-surface-2 border border-border rounded px-2 py-2 text-foreground" value={form.apiPassphrase ?? ''} onChange={(e) => setForms((prev) => ({ ...prev, polymarket: { ...prev.polymarket, apiPassphrase: e.target.value } }))} />
                    </label>
                    <label className="text-xs text-muted-foreground md:col-span-2">Wallet Private Key (optional signer path)
                      <textarea className="mt-1 w-full bg-surface-2 border border-border rounded px-2 py-2 text-foreground" rows={3} value={form.walletPrivateKey ?? ''} onChange={(e) => setForms((prev) => ({ ...prev, polymarket: { ...prev.polymarket, walletPrivateKey: e.target.value } }))} />
                    </label>
                  </>
                ) : (
                  <label className="text-xs text-muted-foreground md:col-span-2">RSA Private Key (PEM)
                    <textarea className="mt-1 w-full bg-surface-2 border border-border rounded px-2 py-2 text-foreground" rows={4} value={form.privateKeyPem ?? ''} onChange={(e) => setForms((prev) => ({ ...prev, kalshi: { ...prev.kalshi, privateKeyPem: e.target.value } }))} />
                  </label>
                )}
              </div>

              {current?.last_error ? <div className="text-xs text-loss bg-loss/10 border border-loss/30 p-2 rounded">Last error: {current.last_error}</div> : null}

              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-semibold" onClick={() => connect.mutate({ provider: provider.id })}>Save / Reconnect</button>
                <button className="px-3 py-2 rounded bg-surface-2 text-foreground text-xs font-semibold border border-border" onClick={() => testConnection.mutate(provider.id)}><Shield className="w-3 h-3 inline mr-1" />Test Connection</button>
                <button className="px-3 py-2 rounded bg-surface-2 text-foreground text-xs font-semibold border border-border" onClick={() => syncFees.mutate(provider.id)}><RefreshCw className="w-3 h-3 inline mr-1" />Sync Fees</button>
                <button className="px-3 py-2 rounded bg-loss/15 text-loss text-xs font-semibold" onClick={() => disconnect.mutate(provider.id)}><Trash2 className="w-3 h-3 inline mr-1" />Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatusRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between bg-surface-2 rounded p-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-foreground">{value}</span>
  </div>
);

export default SettingsPage;
