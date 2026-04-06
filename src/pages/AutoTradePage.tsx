import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ShieldAlert, TrendingUp, Activity, Power, AlertTriangle, Clock, DollarSign, Target, RefreshCw, Wallet, Play, Pause, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
  paper_bankroll: number;
  paper_bankroll_initial: number;
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

interface EngineRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  signals_found: number;
  trades_executed: number;
  trades_skipped: number;
  paper_mode: boolean;
  error_message: string | null;
  details: Record<string, unknown>;
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
  paper_bankroll: 1000,
  paper_bankroll_initial: 1000,
};

const EXCHANGE_BALANCE_STORAGE_KEY = 'kso_exchange_balance';
const POLY_BALANCE_STORAGE_KEY = 'kso_poly_balance';
const ENGINE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const defaultExchangeBalance: ExchangeBalanceState = { available: null, total: null, livePositions: 0, liveOrders: 0, lastSynced: null, error: null };
const defaultPolyBalance: PolymarketBalanceState = { available: null, livePositions: 0, liveOrders: 0, lastSynced: null, error: null };

const AutoTradePage = () => {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<typeof defaultSettings>(defaultSettings);
  const [exchangeBalance, setExchangeBalance] = useState<ExchangeBalanceState>(() => {
    try { const s = localStorage.getItem(EXCHANGE_BALANCE_STORAGE_KEY); return s ? { ...defaultExchangeBalance, ...JSON.parse(s) } : defaultExchangeBalance; } catch { return defaultExchangeBalance; }
  });
  const [polyBalance, setPolyBalance] = useState<PolymarketBalanceState>(() => {
    try { const s = localStorage.getItem(POLY_BALANCE_STORAGE_KEY); return s ? { ...defaultPolyBalance, ...JSON.parse(s) } : defaultPolyBalance; } catch { return defaultPolyBalance; }
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const persistExchangeBalance = (next: ExchangeBalanceState) => { setExchangeBalance(next); localStorage.setItem(EXCHANGE_BALANCE_STORAGE_KEY, JSON.stringify(next)); };
  const persistPolyBalance = (next: PolymarketBalanceState) => { setPolyBalance(next); localStorage.setItem(POLY_BALANCE_STORAGE_KEY, JSON.stringify(next)); };

  const persistSettings = async (newSettings: typeof defaultSettings) => {
    if (settings?.id) {
      const { error } = await supabase.from('auto_trade_settings').update(newSettings).eq('id', settings.id);
      if (error) throw error;
      return;
    }
    const { error } = await supabase.from('auto_trade_settings').insert({ ...newSettings, user_id: session!.user.id });
    if (error) throw error;
  };

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => { const { data } = await supabase.auth.getSession(); return data.session; },
  });

  const { data: settings } = useQuery({
    queryKey: ['auto-trade-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('auto_trade_settings').select('*').single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as AutoTradeSettings | null;
    },
    enabled: !!session,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('positions').select('*').order('opened_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data as Position[];
    },
    enabled: !!session, refetchOnWindowFocus: false,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['order-history'],
    queryFn: async () => {
      const { data, error } = await supabase.from('order_history').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data as OrderHistoryRow[];
    },
    enabled: !!session, refetchOnWindowFocus: false,
  });

  const { data: dailyPnl } = useQuery({
    queryKey: ['daily-pnl'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('daily_pnl').select('*').eq('trade_date', today).single();
      return data;
    },
    enabled: !!session, refetchOnWindowFocus: false,
  });

  const { data: engineRuns = [] } = useQuery({
    queryKey: ['engine-runs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('engine_runs').select('*').order('started_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data as EngineRun[];
    },
    enabled: !!session, refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        enabled: settings.enabled, kill_switch: settings.kill_switch,
        max_daily_loss: settings.max_daily_loss, max_position_size: settings.max_position_size,
        max_open_positions: settings.max_open_positions, min_signal_score: settings.min_signal_score,
        min_confidence: settings.min_confidence, cooldown_seconds: settings.cooldown_seconds,
        allowed_providers: settings.allowed_providers, paper_mode: settings.paper_mode,
        paper_bankroll: (settings as any).paper_bankroll ?? 1000,
        paper_bankroll_initial: (settings as any).paper_bankroll_initial ?? 1000,
      });
    }
  }, [settings]);

  // ─── ENGINE EXECUTION ───
  const runEngine = useCallback(async () => {
    try {
      console.log('[AUTO-TRADE] Running engine cycle...');
      const { data, error } = await supabase.functions.invoke('auto-trade-loop');
      if (error) throw error;
      console.log('[AUTO-TRADE] Engine result:', data);

      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      queryClient.invalidateQueries({ queryKey: ['daily-pnl'] });
      queryClient.invalidateQueries({ queryKey: ['engine-runs'] });

      if (data?.executed > 0) {
        toast.success(`🚀 Engine placed ${data.executed} trade(s)! ${data.paperMode ? '(Paper)' : '(LIVE)'}`, { duration: 8000 });
      } else if (data?.status === 'completed') {
        toast.info(`Engine scanned ${data.signals} signals — ${data.qualified} qualified, 0 new trades.`);
      } else {
        toast.info(`Engine: ${data?.reason || data?.status || 'No action'}`);
      }
      return data;
    } catch (err) {
      console.error('[AUTO-TRADE] Engine error:', err);
      toast.error(`Engine error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }, [queryClient]);

  const runEngineMutation = useMutation({
    mutationFn: runEngine,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['engine-runs'] }),
  });

  // ─── AUTO LOOP ───
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }

    if (settings?.enabled && !settings?.kill_switch && session) {
      setCountdown(ENGINE_INTERVAL_MS / 1000);

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) return ENGINE_INTERVAL_MS / 1000;
          return prev - 1;
        });
      }, 1000);

      // Engine loop
      intervalRef.current = setInterval(() => {
        runEngine();
      }, ENGINE_INTERVAL_MS);
    } else {
      setCountdown(null);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [settings?.enabled, settings?.kill_switch, session, runEngine]);

  const saveMutation = useMutation({
    mutationFn: persistSettings,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auto-trade-settings'] }); },
    onError: (err) => toast.error(String(err)),
  });

  const modeMutation = useMutation({
    mutationFn: async (paperMode: boolean) => {
      const nextSettings = { ...localSettings, paper_mode: paperMode };
      setLocalSettings(nextSettings);
      await persistSettings(nextSettings);
      return paperMode;
    },
    onSuccess: (paperMode) => { queryClient.invalidateQueries({ queryKey: ['auto-trade-settings'] }); toast.success(paperMode ? 'Paper mode enabled' : 'Live mode enabled'); },
    onError: (err) => { setLocalSettings(prev => ({ ...prev, paper_mode: settings?.paper_mode ?? true })); toast.error(String(err)); },
  });

  const killSwitchMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      await supabase.from('auto_trade_settings').update({ kill_switch: true, enabled: false }).eq('id', settings.id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auto-trade-settings'] }); toast.warning('🛑 KILL SWITCH ACTIVATED — All trading halted'); },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const kalshiRes = await supabase.functions.invoke('sync-positions').catch((e: any) => ({ data: null, error: e }));
      let polyData: any = null;
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const sess = (await supabase.auth.getSession()).data.session;
        if (sess && projectId) {
          const polyResp = await fetch(`https://${projectId}.supabase.co/functions/v1/polymarket-proxy?action=live-balance`, {
            headers: { Authorization: `Bearer ${sess.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          });
          if (polyResp.ok) polyData = await polyResp.json();
        }
      } catch {}
      return { kalshi: kalshiRes?.data ?? null, kalshiError: kalshiRes?.error ? String(kalshiRes.error) : null, poly: polyData };
    },
    onSuccess: ({ kalshi, kalshiError, poly }) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      persistExchangeBalance({
        available: kalshi?.balance?.available ?? null, total: kalshi?.balance?.total ?? null,
        livePositions: kalshi?.livePositions ?? 0, liveOrders: kalshi?.liveOrders ?? 0,
        lastSynced: new Date().toLocaleTimeString(),
        error: kalshiError ?? kalshi?.error ?? (kalshi?.balance ? null : 'Kalshi auth failed: incorrect API key signature.'),
      });
      if (poly) {
        const polyBal = poly.balance;
        const polyAvailable = polyBal != null ? (typeof polyBal === 'number' ? polyBal : Number(polyBal?.balance ?? polyBal?.available ?? polyBal?.value ?? 0)) : null;
        persistPolyBalance({
          available: polyAvailable, livePositions: Array.isArray(poly.positions) ? poly.positions.length : 0,
          liveOrders: poly.openOrders ?? 0, lastSynced: new Date().toLocaleTimeString(),
          error: poly.error ?? null,
        });
      }
      toast.success(kalshi?.balance ? 'Synced accounts' : 'Sync completed, but Kalshi authentication failed');
    },
    onError: (err) => {
      persistExchangeBalance({ ...exchangeBalance, lastSynced: new Date().toLocaleTimeString(), error: String(err) });
      toast.error(`Sync failed: ${String(err)}`);
    },
  });

  const openPositions = positions.filter(p => p.status === 'open');
  const marketTitleMap = new Map(positions.map(p => [p.market_id, p.market_title]));
  const positionByMarket = new Map(positions.map(p => [p.market_id, p]));
  const paperPositions = positions.filter(p => p.paper_mode);
  const livePositions = positions.filter(p => !p.paper_mode);
  const paperPnl = paperPositions.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const livePnl = livePositions.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const totalPnl = positions.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const totalPortfolio = (exchangeBalance.available ?? 0) + (exchangeBalance.total ?? 0) + (polyBalance.available ?? 0);
  const paperExposure = paperPositions.filter(p => p.status === 'open').reduce((s, p) => s + p.size, 0);
  const paperBankrollCurrent = localSettings.paper_bankroll_initial - paperExposure + paperPnl;
  const lastRun = engineRuns[0];
  const engineActive = settings?.enabled && !settings?.kill_switch;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-warning mx-auto" />
            <h2 className="text-lg font-bold">Authentication Required</h2>
            <p className="text-sm text-muted-foreground">Sign in to access auto-trading.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> Auto-Trade Engine
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} /> Sync
          </Button>
          {!localSettings.paper_mode && <Badge variant="outline" className="text-profit border-profit/40">LIVE</Badge>}
          {localSettings.paper_mode && <Badge variant="outline" className="text-warning border-warning/40">PAPER MODE</Badge>}
          {settings?.kill_switch && <Badge variant="destructive">KILL SWITCH ON</Badge>}
        </div>
      </div>

      <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span><strong>Educational & simulation purposes only.</strong> Auto-trading involves significant risk. Paper mode is enabled by default.</span>
      </div>

      {/* ─── ENGINE STATUS PANEL ─── */}
      <Card className={`border-2 ${engineActive ? 'border-profit/50 bg-profit/5' : 'border-muted'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${engineActive ? 'bg-profit animate-pulse' : 'bg-muted-foreground'}`} />
              <div>
                <p className="text-sm font-bold">{engineActive ? '🟢 ENGINE RUNNING' : '🔴 ENGINE STOPPED'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {engineActive
                    ? countdown !== null ? `Next scan in ${formatCountdown(countdown)}` : 'Auto-scanning every 5 minutes'
                    : settings?.kill_switch ? 'Kill switch active' : 'Enable auto-trade to start'}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => runEngineMutation.mutate()}
              disabled={runEngineMutation.isPending || !settings?.enabled}
              className="gap-1.5"
            >
              {runEngineMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {runEngineMutation.isPending ? 'Running...' : 'Run Now'}
            </Button>
          </div>

          {/* Last run info */}
          {lastRun && (
            <div className="bg-card rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Last Run</span>
                <span className="font-mono">{new Date(lastRun.started_at).toLocaleTimeString()}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">Status</p>
                  <div className="flex items-center justify-center gap-1">
                    {lastRun.status === 'completed' ? <CheckCircle className="w-3 h-3 text-profit" /> : lastRun.status === 'error' ? <XCircle className="w-3 h-3 text-loss" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                    <span className="text-[11px] font-semibold capitalize">{lastRun.status}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Signals</p>
                  <p className="text-sm font-bold font-mono">{lastRun.signals_found}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Executed</p>
                  <p className="text-sm font-bold font-mono text-profit">{lastRun.trades_executed}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Skipped</p>
                  <p className="text-sm font-bold font-mono text-muted-foreground">{lastRun.trades_skipped}</p>
                </div>
              </div>
              {lastRun.error_message && (
                <div className="bg-loss/10 border border-loss/30 rounded p-2 text-[10px] text-loss">{lastRun.error_message}</div>
              )}
              {lastRun.paper_mode && <Badge variant="outline" className="text-warning border-warning/40 text-[9px]">PAPER</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── BANKROLL MANAGER ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Paper Bankroll */}
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-warning" />
              <span className="text-sm font-bold">Paper Bankroll</span>
              <Badge variant="outline" className="text-warning border-warning/40 text-[9px] ml-auto">SIM</Badge>
            </div>
            <p className={`text-2xl font-bold font-mono ${paperBankrollCurrent >= localSettings.paper_bankroll_initial ? 'text-profit' : 'text-loss'}`}>
              ${paperBankrollCurrent.toFixed(2)}
            </p>
            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              <span>Started: ${localSettings.paper_bankroll_initial.toFixed(0)}</span>
              <span className={`font-mono font-bold ${paperPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {paperPnl >= 0 ? '+' : ''}${paperPnl.toFixed(2)} ({localSettings.paper_bankroll_initial > 0 ? ((paperPnl / localSettings.paper_bankroll_initial) * 100).toFixed(1) : '0'}%)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px]">
              <span className="text-muted-foreground">Open: {paperPositions.filter(p => p.status === 'open').length}</span>
              <span className="text-muted-foreground">Closed: {paperPositions.filter(p => p.status !== 'open').length}</span>
            </div>
          </CardContent>
        </Card>

        {/* Live Exchange Balances */}
        <Card className="border-profit/30 bg-profit/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-profit" />
              <span className="text-sm font-bold">Kalshi</span>
              <Badge variant="outline" className="text-profit border-profit/40 text-[9px] ml-auto">LIVE</Badge>
            </div>
            {exchangeBalance.available !== null ? (
              <>
                <p className="text-2xl font-bold font-mono text-foreground">${exchangeBalance.available.toFixed(2)}</p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>Total: ${exchangeBalance.total?.toFixed(2) ?? '—'}</span>
                  <span>{exchangeBalance.livePositions} pos · {exchangeBalance.liveOrders} orders</span>
                </div>
                {exchangeBalance.lastSynced && <p className="text-[9px] text-muted-foreground mt-1">Synced: {exchangeBalance.lastSynced}</p>}
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">Tap <strong>Sync</strong> to connect</p>
            )}
            {exchangeBalance.error && <p className="text-[10px] text-loss mt-1">{exchangeBalance.error}</p>}
          </CardContent>
        </Card>

        <Card className="border-profit/30 bg-profit/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-profit" />
              <span className="text-sm font-bold">Polymarket</span>
              <Badge variant="outline" className="text-profit border-profit/40 text-[9px] ml-auto">LIVE</Badge>
            </div>
            {polyBalance.available !== null ? (
              <>
                <p className="text-2xl font-bold font-mono text-foreground">${polyBalance.available.toFixed(2)}</p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{polyBalance.livePositions} pos · {polyBalance.liveOrders} orders</span>
                </div>
                {polyBalance.lastSynced && <p className="text-[9px] text-muted-foreground mt-1">Synced: {polyBalance.lastSynced}</p>}
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">Tap <strong>Sync</strong> to connect</p>
            )}
            {polyBalance.error && <p className="text-[10px] text-loss mt-1">{polyBalance.error}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Total Portfolio */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-accent" />
              <span className="text-sm font-bold">Total Live Portfolio</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-mono text-foreground">${totalPortfolio.toFixed(2)}</p>
              <p className={`text-xs font-mono font-bold ${livePnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                Live P&L: {livePnl >= 0 ? '+' : ''}${livePnl.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Kill Switch */}
      <Card className="border-loss/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Power className="w-5 h-5 text-loss" />
            <div>
              <p className="text-sm font-bold">Emergency Kill Switch</p>
              <p className="text-[10px] text-muted-foreground">Immediately halts all automated trading</p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => killSwitchMutation.mutate()} disabled={settings?.kill_switch || !settings?.enabled}>
            {settings?.kill_switch ? '🛑 ACTIVE' : 'ACTIVATE'}
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open Positions', value: openPositions.length.toString(), icon: Activity, color: 'text-primary' },
          { label: 'Today P&L', value: `$${(dailyPnl?.realized_pnl ?? 0).toFixed(2)}`, icon: DollarSign, color: (dailyPnl?.realized_pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss' },
          { label: 'Total Trades', value: (dailyPnl?.trade_count ?? 0).toString(), icon: Target, color: 'text-foreground' },
          { label: 'Total P&L', value: `$${totalPnl.toFixed(2)}`, icon: TrendingUp, color: totalPnl >= 0 ? 'text-profit' : 'text-loss' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1"><Icon className={`w-3.5 h-3.5 ${color}`} /><span className="text-[10px] text-muted-foreground">{label}</span></div>
              <span className={`text-lg font-bold font-mono ${color}`}>{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engine Run History */}
      {engineRuns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Engine Run History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-1.5 text-left">Time</th>
                    <th className="px-2 py-1.5 text-left">Status</th>
                    <th className="px-2 py-1.5 text-left">Signals</th>
                    <th className="px-2 py-1.5 text-left">Trades</th>
                    <th className="px-2 py-1.5 text-left">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {engineRuns.map(run => (
                    <tr key={run.id} className="border-b border-border/30">
                      <td className="px-2 py-1.5 text-muted-foreground font-mono">{new Date(run.started_at).toLocaleTimeString()}</td>
                      <td className="px-2 py-1.5">
                        <span className={`font-semibold ${run.status === 'completed' ? 'text-profit' : run.status === 'error' ? 'text-loss' : 'text-muted-foreground'}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-mono">{run.signals_found}</td>
                      <td className="px-2 py-1.5 font-mono font-bold text-profit">{run.trades_executed}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline" className={`text-[9px] ${run.paper_mode ? 'text-warning border-warning/40' : 'text-profit border-profit/40'}`}>
                          {run.paper_mode ? 'PAPER' : 'LIVE'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engine Settings */}
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
              <p className="text-[10px] text-muted-foreground">Engine scans & executes every 5 minutes while ON</p>
            </div>
            <Switch checked={localSettings.enabled} onCheckedChange={v => {
              const next = { ...localSettings, enabled: v };
              setLocalSettings(next);
              saveMutation.mutate(next, {
                onSuccess: () => {
                  toast.success(v ? '🟢 Auto-Trade enabled' : '🔴 Auto-Trade disabled');
                  if (v) {
                    runEngineMutation.mutate();
                  }
                },
              });
            }} disabled={saveMutation.isPending} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Trading Mode</p>
              <p className="text-[10px] text-muted-foreground">Paper = simulation, Live = real money</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-semibold ${!localSettings.paper_mode ? 'text-muted-foreground' : 'text-warning'}`}>PAPER</span>
              <Switch checked={!localSettings.paper_mode} onCheckedChange={checked => modeMutation.mutate(!checked)} disabled={modeMutation.isPending} />
              <span className={`text-[10px] font-semibold ${localSettings.paper_mode ? 'text-muted-foreground' : 'text-profit'}`}>LIVE</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1"><span className="text-sm">Max Daily Loss</span><span className="text-sm font-mono font-bold text-loss">${localSettings.max_daily_loss}</span></div>
            <Slider value={[localSettings.max_daily_loss]} min={10} max={500} step={10} onValueChange={([v]) => setLocalSettings(s => ({ ...s, max_daily_loss: v }))} />
          </div>
          <div>
            <div className="flex justify-between mb-1"><span className="text-sm">Max Position Size</span><span className="text-sm font-mono font-bold">${localSettings.max_position_size}</span></div>
            <Slider value={[localSettings.max_position_size]} min={5} max={200} step={5} onValueChange={([v]) => setLocalSettings(s => ({ ...s, max_position_size: v }))} />
          </div>
          <div>
            <div className="flex justify-between mb-1"><span className="text-sm">Max Open Positions</span><span className="text-sm font-mono font-bold">{localSettings.max_open_positions}</span></div>
            <Slider value={[localSettings.max_open_positions]} min={1} max={20} step={1} onValueChange={([v]) => setLocalSettings(s => ({ ...s, max_open_positions: v }))} />
          </div>
          <div>
            <div className="flex justify-between mb-1"><span className="text-sm">Min Signal Score</span><span className="text-sm font-mono font-bold">{localSettings.min_signal_score}</span></div>
            <Slider value={[localSettings.min_signal_score]} min={1} max={10} step={0.5} onValueChange={([v]) => setLocalSettings(s => ({ ...s, min_signal_score: v }))} />
          </div>
          <div>
            <div className="flex justify-between mb-1"><span className="text-sm">Min Confidence</span><span className="text-sm font-mono font-bold">{localSettings.min_confidence}%</span></div>
            <Slider value={[localSettings.min_confidence]} min={10} max={95} step={5} onValueChange={([v]) => setLocalSettings(s => ({ ...s, min_confidence: v }))} />
          </div>
          <div>
            <div className="flex justify-between mb-1"><span className="text-sm">Cooldown Between Trades</span><span className="text-sm font-mono font-bold">{Math.floor(localSettings.cooldown_seconds / 60)}m</span></div>
            <Slider value={[localSettings.cooldown_seconds]} min={60} max={1800} step={60} onValueChange={([v]) => setLocalSettings(s => ({ ...s, cooldown_seconds: v }))} />
          </div>

          <div>
            <p className="text-sm mb-2">Allowed Providers</p>
            <div className="flex gap-2">
              {['kalshi', 'polymarket'].map(p => (
                <button key={p} onClick={() => setLocalSettings(s => ({
                  ...s, allowed_providers: s.allowed_providers.includes(p) ? s.allowed_providers.filter(x => x !== p) : [...s.allowed_providers, p],
                }))} className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors ${localSettings.allowed_providers.includes(p) ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={() => saveMutation.mutate(localSettings, { onSuccess: () => toast.success('Settings saved') })} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Open Positions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Open Positions ({openPositions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {openPositions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No open positions</p>
          ) : (
            <div className="space-y-2">
              {openPositions.map(pos => (
                <div key={pos.id} className="bg-surface-2 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium truncate max-w-[220px]">{pos.market_title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={pos.side === 'yes' ? 'text-profit border-profit/40' : 'text-loss border-loss/40'}>{pos.side.toUpperCase()}</Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">{pos.provider}</span>
                        {pos.paper_mode && <Badge variant="outline" className="text-warning border-warning/40 text-[9px]">PAPER</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-mono font-bold ${(pos.pnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {(pos.pnl ?? 0) >= 0 ? '+' : ''}${(pos.pnl ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-[10px] font-mono text-muted-foreground">
                    <div>
                      <span className="block text-[9px] uppercase tracking-wide">Entry</span>
                      <span className="text-foreground">{(pos.entry_price * 100).toFixed(0)}¢</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase tracking-wide">Target</span>
                      <span className="text-foreground">{pos.target_price ? `${(pos.target_price * 100).toFixed(0)}¢` : '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase tracking-wide">Size</span>
                      <span className="text-foreground">${pos.size.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase tracking-wide">Contracts</span>
                      <span className="text-foreground">{Math.max(1, Math.floor(pos.size / pos.entry_price))}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> Recent Orders ({orders.length})</CardTitle>
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
                    <th className="px-2 py-1.5 text-left">Entry</th>
                    <th className="px-2 py-1.5 text-left">Target</th>
                    <th className="px-2 py-1.5 text-left">Size</th>
                    <th className="px-2 py-1.5 text-left">P&L</th>
                    <th className="px-2 py-1.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 20).map(o => {
                    const pos = positionByMarket.get(o.market_id);
                    const targetPrice = pos?.target_price;
                    const currentPrice = pos?.current_price ?? o.price;
                    const pnl = pos?.pnl ?? (o.side === 'yes'
                      ? (currentPrice - o.price) * (o.size / o.price)
                      : (o.price - currentPrice) * (o.size / o.price));
                    const pnlValue = Number(pnl) || 0;
                    return (
                    <tr key={o.id} className="border-b border-border/30">
                      <td className="px-2 py-1.5 text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()}</td>
                      <td className="px-2 py-1.5 truncate max-w-[200px]">{marketTitleMap.get(o.market_id) || o.market_id}</td>
                      <td className="px-2 py-1.5"><span className={o.side === 'yes' ? 'text-profit' : 'text-loss'}>{o.side.toUpperCase()}</span></td>
                      <td className="px-2 py-1.5 font-mono">{(o.price * 100).toFixed(0)}¢</td>
                      <td className="px-2 py-1.5 font-mono">{targetPrice ? `${(targetPrice * 100).toFixed(0)}¢` : '—'}</td>
                      <td className="px-2 py-1.5 font-mono">${o.size.toFixed(2)}</td>
                      <td className={`px-2 py-1.5 font-mono font-bold ${pnlValue >= 0 ? 'text-profit' : 'text-loss'}`}>{pnlValue >= 0 ? '+' : ''}{pnlValue.toFixed(2)}</td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className="text-[9px]">{o.status}</Badge></td>
                    </tr>);
                  })}
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
