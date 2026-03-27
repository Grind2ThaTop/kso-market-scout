import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ShieldAlert, TrendingUp, Activity, Power, AlertTriangle, Clock, DollarSign, Target, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';

interface AutoTradeSettings {
  id: string;
  user_id: string;
  enabled: boolean;
  kill_switch: boolean;
  max_daily_loss: number;
  max_position_size: number;
  max_open_positions: number;
  min_signal_score: number;
  min_confidence: number;
  cooldown_seconds: number;
  allowed_providers: string[];
  paper_mode: boolean;
}

interface Position {
  id: string;
  market_id: string;
  market_title: string;
  provider: string;
  side: 'yes' | 'no';
  entry_price: number;
  current_price: number | null;
  size: number;
  stop_price: number | null;
  target_price: number | null;
  status: string;
  pnl: number;
  signal_score: number | null;
  confidence: number | null;
  setup_type: string | null;
  paper_mode: boolean;
  opened_at: string;
  closed_at: string | null;
}

interface OrderHistoryRow {
  id: string;
  market_id: string;
  provider: string;
  side: 'yes' | 'no';
  price: number;
  size: number;
  status: string;
  paper_mode: boolean;
  created_at: string;
}

interface ExchangeBalanceState {
  available: number | null;
  total: number | null;
  livePositions: number;
  liveOrders: number;
  lastSynced: string | null;
  error: string | null;
}

interface PolymarketBalanceState {
  available: number | null;
  livePositions: number;
  liveOrders: number;
  lastSynced: string | null;
  error: string | null;
}

const defaultSettings: Omit<AutoTradeSettings, 'id' | 'user_id'> = {
  enabled: false,
  kill_switch: false,
  max_daily_loss: 50,
  max_position_size: 25,
  max_open_positions: 5,
  min_signal_score: 7,
  min_confidence: 60,
  cooldown_seconds: 300,
  allowed_providers: ['kalshi', 'polymarket'],
  paper_mode: true,
};

const EXCHANGE_BALANCE_STORAGE_KEY = 'kso_exchange_balance';
const POLY_BALANCE_STORAGE_KEY = 'kso_poly_balance';

const defaultExchangeBalance: ExchangeBalanceState = {
  available: null,
  total: null,
  livePositions: 0,
  liveOrders: 0,
  lastSynced: null,
  error: null,
};

const defaultPolyBalance: PolymarketBalanceState = {
  available: null,
  livePositions: 0,
  liveOrders: 0,
  lastSynced: null,
  error: null,
};

const AutoTradePage = () => {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<typeof defaultSettings>(defaultSettings);
  const [exchangeBalance, setExchangeBalance] = useState<ExchangeBalanceState>(() => {
    try {
      const saved = localStorage.getItem(EXCHANGE_BALANCE_STORAGE_KEY);
      return saved ? { ...defaultExchangeBalance, ...JSON.parse(saved) } : defaultExchangeBalance;
    } catch {
      return defaultExchangeBalance;
    }
  });
  const [polyBalance, setPolyBalance] = useState<PolymarketBalanceState>(() => {
    try {
      const saved = localStorage.getItem(POLY_BALANCE_STORAGE_KEY);
      return saved ? { ...defaultPolyBalance, ...JSON.parse(saved) } : defaultPolyBalance;
    } catch {
      return defaultPolyBalance;
    }
  });

  const persistExchangeBalance = (next: ExchangeBalanceState) => {
    setExchangeBalance(next);
    localStorage.setItem(EXCHANGE_BALANCE_STORAGE_KEY, JSON.stringify(next));
  };
  const persistPolyBalance = (next: PolymarketBalanceState) => {
    setPolyBalance(next);
    localStorage.setItem(POLY_BALANCE_STORAGE_KEY, JSON.stringify(next));
  };

  const persistSettings = async (newSettings: typeof defaultSettings) => {
    if (settings?.id) {
      const { error } = await supabase
        .from('auto_trade_settings')
        .update(newSettings)
        .eq('id', settings.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from('auto_trade_settings')
      .insert({ ...newSettings, user_id: session!.user.id });
    if (error) throw error;
  };

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['auto-trade-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_trade_settings')
        .select('*')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as AutoTradeSettings | null;
    },
    enabled: !!session,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Position[];
    },
    enabled: !!session,
    refetchInterval: 10000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['order-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as OrderHistoryRow[];
    },
    enabled: !!session,
    refetchInterval: 10000,
  });

  const { data: dailyPnl } = useQuery({
    queryKey: ['daily-pnl'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('daily_pnl')
        .select('*')
        .eq('trade_date', today)
        .single();
      return data;
    },
    enabled: !!session,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        enabled: settings.enabled,
        kill_switch: settings.kill_switch,
        max_daily_loss: settings.max_daily_loss,
        max_position_size: settings.max_position_size,
        max_open_positions: settings.max_open_positions,
        min_signal_score: settings.min_signal_score,
        min_confidence: settings.min_confidence,
        cooldown_seconds: settings.cooldown_seconds,
        allowed_providers: settings.allowed_providers,
        paper_mode: settings.paper_mode,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: persistSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-trade-settings'] });
      toast.success('Settings saved');
    },
    onError: (err) => toast.error(String(err)),
  });

  const modeMutation = useMutation({
    mutationFn: async (paperMode: boolean) => {
      const nextSettings = { ...localSettings, paper_mode: paperMode };
      setLocalSettings(nextSettings);
      await persistSettings(nextSettings);
      return paperMode;
    },
    onSuccess: (paperMode) => {
      queryClient.invalidateQueries({ queryKey: ['auto-trade-settings'] });
      toast.success(paperMode ? 'Paper mode enabled' : 'Live mode enabled');
    },
    onError: (err) => {
      setLocalSettings((prev) => ({ ...prev, paper_mode: settings?.paper_mode ?? true }));
      toast.error(String(err));
    },
  });

  const killSwitchMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      await supabase
        .from('auto_trade_settings')
        .update({ kill_switch: true, enabled: false })
        .eq('id', settings.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-trade-settings'] });
      toast.warning('🛑 KILL SWITCH ACTIVATED — All trading halted');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      // Sync Kalshi positions
      const kalshiRes = await supabase.functions.invoke('sync-positions').catch((e: any) => ({ data: null, error: e }));

      // Sync Polymarket live balance
      let polyData: any = null;
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const session = (await supabase.auth.getSession()).data.session;
        if (session && projectId) {
          const polyResp = await fetch(
            `https://${projectId}.supabase.co/functions/v1/polymarket-proxy?action=live-balance`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
            }
          );
          if (polyResp.ok) polyData = await polyResp.json();
        }
      } catch {}

      const kalshiData = kalshiRes?.data ?? null;
      const kalshiError = kalshiRes?.error ? String(kalshiRes.error) : kalshiData?.error ?? null;

      return { kalshi: kalshiData, kalshiError, poly: polyData };
    },
    onSuccess: ({ kalshi, kalshiError, poly }) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });

      persistExchangeBalance({
        available: kalshi?.balance?.available ?? null,
        total: kalshi?.balance?.total ?? null,
        livePositions: kalshi?.livePositions ?? 0,
        liveOrders: kalshi?.liveOrders ?? 0,
        lastSynced: new Date().toLocaleTimeString(),
        error: kalshiError ? String(kalshiError) : (kalshi?.balance ? null : 'Kalshi: No balance returned. Check API credentials.'),
      });

      if (poly) {
        const polyBal = poly.balance;
        const polyAvailable = polyBal != null
          ? (typeof polyBal === 'number' ? polyBal : Number(polyBal?.balance ?? polyBal?.available ?? 0))
          : null;
        persistPolyBalance({
          available: polyAvailable,
          livePositions: Array.isArray(poly.positions) ? poly.positions.length : 0,
          liveOrders: poly.openOrders ?? 0,
          lastSynced: new Date().toLocaleTimeString(),
          error: poly.error ?? (poly.errors?.length ? poly.errors.join('; ') : null),
        });
      }

      toast.success(`Synced accounts`);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err);
      persistExchangeBalance({
        ...exchangeBalance,
        lastSynced: new Date().toLocaleTimeString(),
        error: message,
      });
      toast.error(`Sync failed: ${message}`);
    },
  });

  const openPositions = positions.filter((p) => p.status === 'open');
  const totalPnl = positions.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const totalPortfolio = (exchangeBalance.available ?? 0) + (exchangeBalance.total ?? 0) + (polyBalance.available ?? 0);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-warning mx-auto" />
            <h2 className="text-lg font-bold">Authentication Required</h2>
            <p className="text-sm text-muted-foreground">Sign in to access auto-trading. Your API credentials and trade data are encrypted and stored securely.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> Auto-Trade Engine
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          {!localSettings.paper_mode && (
            <Badge variant="outline" className="text-profit border-profit/40">LIVE</Badge>
          )}
          {localSettings.paper_mode && (
            <Badge variant="outline" className="text-warning border-warning/40">PAPER MODE</Badge>
          )}
          {settings?.kill_switch && <Badge variant="destructive">KILL SWITCH ON</Badge>}
        </div>
      </div>

      <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span><strong>Educational & simulation purposes only.</strong> Auto-trading involves significant risk. Paper mode is enabled by default. You are solely responsible for any live trades.</span>
      </div>

      {/* Total Portfolio */}
      {(exchangeBalance.available !== null || polyBalance.available !== null) && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-accent" />
              <span className="text-sm font-bold">Total Portfolio</span>
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">${totalPortfolio.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Combined across all connected exchanges</p>
          </CardContent>
        </Card>
      )}

      {/* Exchange Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Kalshi */}
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Kalshi</span>
              </div>
              {exchangeBalance.lastSynced && (
                <span className="text-[10px] text-muted-foreground">Synced: {exchangeBalance.lastSynced}</span>
              )}
            </div>
            {exchangeBalance.available !== null ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Available</p>
                  <p className="text-lg font-bold text-foreground">${exchangeBalance.available.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="text-lg font-bold text-foreground">${exchangeBalance.total?.toFixed(2) ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Positions</p>
                  <p className="text-sm font-semibold">{exchangeBalance.livePositions}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Orders</p>
                  <p className="text-sm font-semibold">{exchangeBalance.liveOrders}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Tap <strong>Sync</strong> to pull live data.</p>
            )}
            {exchangeBalance.error && (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{exchangeBalance.error}</div>
            )}
          </CardContent>
        </Card>

        {/* Polymarket */}
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Polymarket</span>
              </div>
              {polyBalance.lastSynced && (
                <span className="text-[10px] text-muted-foreground">Synced: {polyBalance.lastSynced}</span>
              )}
            </div>
            {polyBalance.available !== null ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</p>
                  <p className="text-lg font-bold text-foreground">${polyBalance.available.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Positions</p>
                  <p className="text-sm font-semibold">{polyBalance.livePositions}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Open Orders</p>
                  <p className="text-sm font-semibold">{polyBalance.liveOrders}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Tap <strong>Sync</strong> to pull live Polymarket data.</p>
            )}
            {polyBalance.error && (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{polyBalance.error}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-loss/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Power className="w-5 h-5 text-loss" />
            <div>
              <p className="text-sm font-bold">Emergency Kill Switch</p>
              <p className="text-[10px] text-muted-foreground">Immediately halts all automated trading</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => killSwitchMutation.mutate()}
            disabled={settings?.kill_switch || !settings?.enabled}
          >
            {settings?.kill_switch ? '🛑 ACTIVE' : 'ACTIVATE'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open Positions', value: openPositions.length.toString(), icon: Activity, color: 'text-primary' },
          { label: 'Today P&L', value: `$${(dailyPnl?.realized_pnl ?? 0).toFixed(2)}`, icon: DollarSign, color: (dailyPnl?.realized_pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss' },
          { label: 'Total Trades', value: (dailyPnl?.trade_count ?? 0).toString(), icon: Target, color: 'text-foreground' },
          { label: 'Total P&L', value: `$${totalPnl.toFixed(2)}`, icon: TrendingUp, color: totalPnl >= 0 ? 'text-profit' : 'text-loss' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
              <span className={`text-lg font-bold font-mono ${color}`}>{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" /> Engine Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-Trade Enabled</p>
              <p className="text-[10px] text-muted-foreground">Engine will execute trades when signals fire</p>
            </div>
            <Switch
              checked={localSettings.enabled}
              onCheckedChange={(v) => setLocalSettings((s) => ({ ...s, enabled: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Trading Mode</p>
              <p className="text-[10px] text-muted-foreground">Turn this off to switch from paper to live immediately</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-semibold ${!localSettings.paper_mode ? 'text-muted-foreground' : 'text-warning'}`}>PAPER</span>
              <Switch
                checked={!localSettings.paper_mode}
                onCheckedChange={(checked) => modeMutation.mutate(!checked)}
                disabled={modeMutation.isPending}
              />
              <span className={`text-[10px] font-semibold ${localSettings.paper_mode ? 'text-muted-foreground' : 'text-profit'}`}>LIVE</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Max Daily Loss</span>
              <span className="text-sm font-mono font-bold text-loss">${localSettings.max_daily_loss}</span>
            </div>
            <Slider
              value={[localSettings.max_daily_loss]}
              min={10}
              max={500}
              step={10}
              onValueChange={([v]) => setLocalSettings((s) => ({ ...s, max_daily_loss: v }))}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Max Position Size</span>
              <span className="text-sm font-mono font-bold">${localSettings.max_position_size}</span>
            </div>
            <Slider
              value={[localSettings.max_position_size]}
              min={5}
              max={200}
              step={5}
              onValueChange={([v]) => setLocalSettings((s) => ({ ...s, max_position_size: v }))}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Max Open Positions</span>
              <span className="text-sm font-mono font-bold">{localSettings.max_open_positions}</span>
            </div>
            <Slider
              value={[localSettings.max_open_positions]}
              min={1}
              max={20}
              step={1}
              onValueChange={([v]) => setLocalSettings((s) => ({ ...s, max_open_positions: v }))}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Min Signal Score</span>
              <span className="text-sm font-mono font-bold">{localSettings.min_signal_score}</span>
            </div>
            <Slider
              value={[localSettings.min_signal_score]}
              min={1}
              max={10}
              step={0.5}
              onValueChange={([v]) => setLocalSettings((s) => ({ ...s, min_signal_score: v }))}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Min Confidence</span>
              <span className="text-sm font-mono font-bold">{localSettings.min_confidence}%</span>
            </div>
            <Slider
              value={[localSettings.min_confidence]}
              min={10}
              max={95}
              step={5}
              onValueChange={([v]) => setLocalSettings((s) => ({ ...s, min_confidence: v }))}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Cooldown Between Trades</span>
              <span className="text-sm font-mono font-bold">{Math.floor(localSettings.cooldown_seconds / 60)}m</span>
            </div>
            <Slider
              value={[localSettings.cooldown_seconds]}
              min={60}
              max={1800}
              step={60}
              onValueChange={([v]) => setLocalSettings((s) => ({ ...s, cooldown_seconds: v }))}
            />
          </div>

          <div>
            <p className="text-sm mb-2">Allowed Providers</p>
            <div className="flex gap-2">
              {['kalshi', 'polymarket'].map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    setLocalSettings((s) => ({
                      ...s,
                      allowed_providers: s.allowed_providers.includes(p)
                        ? s.allowed_providers.filter((x) => x !== p)
                        : [...s.allowed_providers, p],
                    }))
                  }
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors ${
                    localSettings.allowed_providers.includes(p)
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-2 text-muted-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => saveMutation.mutate(localSettings)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Open Positions ({openPositions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openPositions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No open positions</p>
          ) : (
            <div className="space-y-2">
              {openPositions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between bg-surface-2 rounded-lg p-3">
                  <div>
                    <p className="text-xs font-medium truncate max-w-[200px]">{pos.market_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={pos.side === 'yes' ? 'text-profit border-profit/40' : 'text-loss border-loss/40'}>
                        {pos.side.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{pos.provider}</span>
                      {pos.paper_mode && <Badge variant="outline" className="text-warning border-warning/40 text-[9px]">PAPER</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono">Entry: {(pos.entry_price * 100).toFixed(0)}¢</p>
                    <p className={`text-xs font-mono font-bold ${pos.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      P&L: ${pos.pnl.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Recent Orders ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No orders yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-1.5 text-left">Time</th>
                    <th className="px-2 py-1.5 text-left">Market</th>
                    <th className="px-2 py-1.5 text-left">Side</th>
                    <th className="px-2 py-1.5 text-left">Price</th>
                    <th className="px-2 py-1.5 text-left">Size</th>
                    <th className="px-2 py-1.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 20).map((o) => (
                    <tr key={o.id} className="border-b border-border/30">
                      <td className="px-2 py-1.5 text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()}</td>
                      <td className="px-2 py-1.5 font-mono truncate max-w-[120px]">{o.market_id}</td>
                      <td className="px-2 py-1.5">
                        <span className={o.side === 'yes' ? 'text-profit' : 'text-loss'}>{o.side.toUpperCase()}</span>
                      </td>
                      <td className="px-2 py-1.5 font-mono">{(o.price * 100).toFixed(0)}¢</td>
                      <td className="px-2 py-1.5 font-mono">${o.size.toFixed(2)}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline" className="text-[9px]">{o.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoTradePage;
