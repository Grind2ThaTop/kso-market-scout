import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ShieldAlert, TrendingUp, TrendingDown, Activity, Power, AlertTriangle, Clock, DollarSign, Target, RefreshCw, Wallet } from 'lucide-react';
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

const AutoTradePage = () => {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<typeof defaultSettings>(defaultSettings);

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
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
    mutationFn: async (newSettings: typeof defaultSettings) => {
      if (settings?.id) {
        const { error } = await supabase
          .from('auto_trade_settings')
          .update(newSettings)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('auto_trade_settings')
          .insert({ ...newSettings, user_id: session!.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-trade-settings'] });
      toast.success('Settings saved');
    },
    onError: (err) => toast.error(String(err)),
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
      const { data, error } = await supabase.functions.invoke('sync-positions');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      toast.success(`Synced ${data?.synced ?? 0} positions · Balance: $${data?.balance?.available?.toFixed(2) ?? '—'}`);
    },
    onError: (err) => toast.error(`Sync failed: ${String(err)}`),
  });

  const openPositions = positions.filter(p => p.status === 'open');
  const closedPositions = positions.filter(p => p.status !== 'open');
  const totalPnl = positions.reduce((s, p) => s + (p.pnl ?? 0), 0);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> Auto-Trade Engine
        </h1>
        <div className="flex items-center gap-2">
          {localSettings.paper_mode && (
            <Badge variant="outline" className="text-warning border-warning/40">PAPER MODE</Badge>
          )}
          {settings?.kill_switch && (
            <Badge variant="destructive">KILL SWITCH ON</Badge>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span><strong>Educational & simulation purposes only.</strong> Auto-trading involves significant risk. Paper mode is enabled by default. You are solely responsible for any live trades.</span>
      </div>

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
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
              <span className={`text-lg font-bold font-mono ${color}`}>{value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" /> Engine Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Master Enable */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-Trade Enabled</p>
              <p className="text-[10px] text-muted-foreground">Engine will execute trades when signals fire</p>
            </div>
            <Switch
              checked={localSettings.enabled}
              onCheckedChange={(v) => setLocalSettings(s => ({ ...s, enabled: v }))}
            />
          </div>

          {/* Paper Mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Paper Mode</p>
              <p className="text-[10px] text-muted-foreground">Simulate trades without real money</p>
            </div>
            <Switch
              checked={localSettings.paper_mode}
              onCheckedChange={(v) => setLocalSettings(s => ({ ...s, paper_mode: v }))}
            />
          </div>

          {/* Max Daily Loss */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Max Daily Loss</span>
              <span className="text-sm font-mono font-bold text-loss">${localSettings.max_daily_loss}</span>
            </div>
            <Slider
              value={[localSettings.max_daily_loss]}
              min={10} max={500} step={10}
              onValueChange={([v]) => setLocalSettings(s => ({ ...s, max_daily_loss: v }))}
            />
          </div>

          {/* Max Position Size */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Max Position Size</span>
              <span className="text-sm font-mono font-bold">${localSettings.max_position_size}</span>
            </div>
            <Slider
              value={[localSettings.max_position_size]}
              min={5} max={200} step={5}
              onValueChange={([v]) => setLocalSettings(s => ({ ...s, max_position_size: v }))}
            />
          </div>

          {/* Max Open Positions */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Max Open Positions</span>
              <span className="text-sm font-mono font-bold">{localSettings.max_open_positions}</span>
            </div>
            <Slider
              value={[localSettings.max_open_positions]}
              min={1} max={20} step={1}
              onValueChange={([v]) => setLocalSettings(s => ({ ...s, max_open_positions: v }))}
            />
          </div>

          {/* Min Signal Score */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Min Signal Score</span>
              <span className="text-sm font-mono font-bold">{localSettings.min_signal_score}</span>
            </div>
            <Slider
              value={[localSettings.min_signal_score]}
              min={1} max={10} step={0.5}
              onValueChange={([v]) => setLocalSettings(s => ({ ...s, min_signal_score: v }))}
            />
          </div>

          {/* Min Confidence */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Min Confidence</span>
              <span className="text-sm font-mono font-bold">{localSettings.min_confidence}%</span>
            </div>
            <Slider
              value={[localSettings.min_confidence]}
              min={10} max={95} step={5}
              onValueChange={([v]) => setLocalSettings(s => ({ ...s, min_confidence: v }))}
            />
          </div>

          {/* Cooldown */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm">Cooldown Between Trades</span>
              <span className="text-sm font-mono font-bold">{Math.floor(localSettings.cooldown_seconds / 60)}m</span>
            </div>
            <Slider
              value={[localSettings.cooldown_seconds]}
              min={60} max={1800} step={60}
              onValueChange={([v]) => setLocalSettings(s => ({ ...s, cooldown_seconds: v }))}
            />
          </div>

          {/* Providers */}
          <div>
            <p className="text-sm mb-2">Allowed Providers</p>
            <div className="flex gap-2">
              {['kalshi', 'polymarket'].map(p => (
                <button
                  key={p}
                  onClick={() => setLocalSettings(s => ({
                    ...s,
                    allowed_providers: s.allowed_providers.includes(p)
                      ? s.allowed_providers.filter(x => x !== p)
                      : [...s.allowed_providers, p],
                  }))}
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

      {/* Open Positions */}
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
              {openPositions.map(pos => (
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

      {/* Order History */}
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
                  {orders.slice(0, 20).map(o => (
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
