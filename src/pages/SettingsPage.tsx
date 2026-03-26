import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw, Shield } from 'lucide-react';
import { integrationsApi } from '@/integrations/api';
import { Provider, ProviderStatus } from '@/integrations/types';
import { useToast } from '@/hooks/use-toast';

const PROVIDERS: { id: Provider; title: string; envs: Array<'prod' | 'demo'>; help: Record<string, string> }[] = [
  {
    id: 'kalshi',
    title: 'Kalshi',
    envs: ['prod', 'demo'],
    help: {
      apiKeyId: 'Kalshi API Key ID from account API settings.',
      privateKeyPem: 'RSA private key PEM matching your Kalshi key ID. Supports escaped newlines.',
    },
  },
  {
    id: 'polymarket',
    title: 'Polymarket',
    envs: ['prod'],
    help: {
      apiKey: 'Polymarket CLOB L2 API key for signed trading requests.',
      apiSecret: 'Polymarket CLOB secret used for HMAC-SHA256 signing.',
      apiPassphrase: 'Polymarket CLOB passphrase paired with API key + secret.',
      walletAddress: 'Wallet address associated with the CLOB API credentials.',
    },
  },
];

const statusClasses: Record<ProviderStatus, string> = {
  connected: 'bg-profit/15 text-profit',
  disconnected: 'bg-muted text-muted-foreground',
  invalid: 'bg-loss/15 text-loss',
  degraded: 'bg-warning/15 text-warning',
  'rate-limited': 'bg-warning/15 text-warning',
};

const SettingsPageContent = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [forms, setForms] = useState<Record<Provider, Record<string, string | boolean>>>({
    kalshi: { enabled: true, environment: 'prod', apiKeyId: '', privateKeyPem: '' },
    polymarket: { enabled: true, environment: 'prod', apiKey: '', apiSecret: '', apiPassphrase: '', walletAddress: '' },
  });

  const { data, isLoading } = useQuery({ queryKey: ['integrations'], queryFn: integrationsApi.list });

  const integrationMap = useMemo(() => {
    const map = new Map<Provider, any>();
    for (const row of data?.providers ?? []) map.set(row.provider, row.integration);
    return map;
  }, [data]);

  const save = useMutation({
    mutationFn: (provider: Provider) => integrationsApi.saveCredentials({
      provider,
      enabled: Boolean(forms[provider].enabled),
      environment: String(forms[provider].environment) as 'prod' | 'demo',
      credentials: Object.fromEntries(Object.entries(forms[provider]).filter(([k]) => !['enabled', 'environment'].includes(k)).map(([k, v]) => [k, String(v ?? '')])),
    }),
    onSuccess: () => {
      toast({ title: 'Credentials saved' });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error: Error) => toast({ title: 'Save failed', description: error.message, variant: 'destructive' }),
  });

  const test = useMutation({
    mutationFn: (provider: Provider) => integrationsApi.testCredentials(provider),
    onSuccess: (result) => {
      toast({ title: `${result.provider} connection test`, description: `Status: ${result.status}` });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error: Error) => toast({ title: 'Test failed', description: error.message, variant: 'destructive' }),
  });

  const sync = useMutation({
    mutationFn: (provider: Provider) => integrationsApi.syncAccount(provider),
    onSuccess: () => {
      toast({ title: 'Account sync complete' });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (error: Error) => toast({ title: 'Sync failed', description: error.message, variant: 'destructive' }),
  });

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground">Prediction Markets Credentials</h1>
      <p className="text-xs text-muted-foreground">Separate provider cards for Kalshi and Polymarket (public data + authenticated trading).</p>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}

      {PROVIDERS.map((provider) => {
        const current = integrationMap.get(provider.id);
        const status = (current?.status ?? 'disconnected') as ProviderStatus;
        return (
          <div key={provider.id} className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Link2 className="w-4 h-4" /> {provider.title}</h2>
              <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${statusClasses[status]}`}>{status}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs">Enabled
                <select className="mt-1 w-full border rounded px-2 py-2 bg-surface-2" value={String(forms[provider.id].enabled)} onChange={(e) => setForms((prev) => ({ ...prev, [provider.id]: { ...prev[provider.id], enabled: e.target.value === 'true' } }))}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
              <label className="text-xs">Environment
                <select className="mt-1 w-full border rounded px-2 py-2 bg-surface-2" value={String(forms[provider.id].environment)} onChange={(e) => setForms((prev) => ({ ...prev, [provider.id]: { ...prev[provider.id], environment: e.target.value } }))}>
                  {provider.envs.map((env) => <option key={env} value={env}>{env}</option>)}
                </select>
              </label>

              {provider.id === 'kalshi' ? (
                <>
                  <InputField label="API Key ID" help={provider.help.apiKeyId} value={String(forms.kalshi.apiKeyId ?? '')} onChange={(v) => setForms((p) => ({ ...p, kalshi: { ...p.kalshi, apiKeyId: v } }))} />
                  <TextAreaField label="RSA Private Key (PEM)" help={provider.help.privateKeyPem} value={String(forms.kalshi.privateKeyPem ?? '')} onChange={(v) => setForms((p) => ({ ...p, kalshi: { ...p.kalshi, privateKeyPem: v } }))} />
                </>
              ) : (
                <>
                  <InputField label="API Key" help={provider.help.apiKey} value={String(forms.polymarket.apiKey ?? '')} onChange={(v) => setForms((p) => ({ ...p, polymarket: { ...p.polymarket, apiKey: v } }))} />
                  <InputField label="Wallet Address" help={provider.help.walletAddress} value={String(forms.polymarket.walletAddress ?? '')} onChange={(v) => setForms((p) => ({ ...p, polymarket: { ...p.polymarket, walletAddress: v } }))} />
                  <InputField label="API Secret" type="password" help={provider.help.apiSecret} value={String(forms.polymarket.apiSecret ?? '')} onChange={(v) => setForms((p) => ({ ...p, polymarket: { ...p.polymarket, apiSecret: v } }))} />
                  <InputField label="API Passphrase" type="password" help={provider.help.apiPassphrase} value={String(forms.polymarket.apiPassphrase ?? '')} onChange={(v) => setForms((p) => ({ ...p, polymarket: { ...p.polymarket, apiPassphrase: v } }))} />
                </>
              )}
            </div>

            <div className="text-xs text-muted-foreground">Last successful sync: {current?.lastSuccessfulSyncAt ? new Date(current.lastSuccessfulSyncAt).toLocaleString() : 'N/A'}</div>
            {current?.lastError ? <div className="text-xs text-loss">Last error: {current.lastError}</div> : null}

            <div className="flex gap-2">
              <button className="px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-semibold" onClick={() => save.mutate(provider.id)}>Save credentials</button>
              <button className="px-3 py-2 rounded border text-xs" onClick={() => test.mutate(provider.id)}><Shield className="w-3 h-3 inline mr-1" />Test connection</button>
              <button className="px-3 py-2 rounded border text-xs" onClick={() => sync.mutate(provider.id)}><RefreshCw className="w-3 h-3 inline mr-1" />Sync account</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

function InputField({ label, value, onChange, help, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; help?: string; type?: string; }) {
  return <label className="text-xs">{label}<input type={type} className="mt-1 w-full border rounded px-2 py-2 bg-surface-2" value={value} onChange={(e) => onChange(e.target.value)} /><span className="block mt-1 text-[10px] text-muted-foreground">{help}</span></label>;
}

function TextAreaField({ label, value, onChange, help }: { label: string; value: string; onChange: (value: string) => void; help?: string; }) {
  return <label className="text-xs md:col-span-2">{label}<textarea className="mt-1 w-full border rounded px-2 py-2 bg-surface-2" rows={4} value={value} onChange={(e) => onChange(e.target.value)} /><span className="block mt-1 text-[10px] text-muted-foreground">{help}</span></label>;
}

export default function SettingsPage() {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}><SettingsPageContent /></QueryClientProvider>;
}
