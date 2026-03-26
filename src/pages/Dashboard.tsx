import { Link } from 'react-router-dom';
import { TrendingUp, Target, AlertTriangle, DollarSign, Activity, WifiOff } from 'lucide-react';
import { useMarketScanner } from '@/hooks/useMarketScanner';
import { scannerConfig } from '@/data/liveApi';

const fmt = (n: number) => `$${n.toFixed(0)}`;
const fmtC = (n: number) => `${(n * 100).toFixed(2)}¢`;

const Dashboard = () => {
  const { data, isLoading, isError, error } = useMarketScanner();

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading live market feed…</div>;
  }

  if (isError) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto bg-card border border-loss/40 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-loss font-semibold"><WifiOff className="w-4 h-4" /> Live data unavailable</div>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Market feed request failed.'}</p>
          <p className="text-xs text-muted-foreground">Set <code>VITE_MARKET_DATA_URL</code> and optional <code>VITE_MARKET_DATA_API_KEY</code> in your environment.</p>
        </div>
      </div>
    );
  }

  const signals = data?.signals ?? [];
  const markets = data?.markets ?? [];
  const quotes = data?.quotes ?? [];

  if (markets.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">No live markets returned by the configured API.</div>;
  }

  const avgEdge = signals.filter((s) => s.action !== 'wait').reduce((sum, sig) => sum + sig.expectedNetEdge, 0) / Math.max(1, signals.filter((s) => s.action !== 'wait').length);
  const remaining = scannerConfig.profile.dailyTarget;
  const tradesNeeded = Math.ceil(remaining / Math.max(0.0001, avgEdge * 30));

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Live Scanner Dashboard</h1>
        <span className="text-xs text-muted-foreground">Last refresh: {new Date(data!.fetchedAt).toLocaleString()}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Daily Target', value: fmt(scannerConfig.profile.dailyTarget), icon: Target, color: 'text-primary' },
          { label: 'Live Markets', value: markets.length.toString(), icon: Activity, color: 'text-foreground' },
          { label: 'Actionable Signals', value: signals.filter((s) => s.action !== 'wait').length.toString(), icon: TrendingUp, color: 'text-profit' },
          { label: 'Avg Net Edge', value: fmtC(avgEdge), icon: DollarSign, color: 'text-profit' },
          { label: 'Max Loss', value: fmt(scannerConfig.profile.maxDailyLoss), icon: AlertTriangle, color: 'text-loss' },
          { label: 'Est. Trades Needed', value: Number.isFinite(tradesNeeded) ? tradesNeeded.toString() : 'N/A', icon: Target, color: 'text-warn' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card border border-border rounded-lg p-3 interactive-lift">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
            <span className={`text-lg font-bold font-mono ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="glass-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Top Live Signals</h2>
          <span className="text-[10px] text-muted-foreground">No synthetic fallbacks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {['Market', 'Category', 'Bid/Ask', 'Spread', 'Score', 'Net Edge', 'Conf', 'Time', 'Action'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((sig) => {
                const mkt = markets.find((m) => m.id === sig.marketId);
                const qt = quotes.find((q) => q.marketId === sig.marketId);
                if (!mkt || !qt) return null;

                return (
                  <tr key={sig.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2"><Link to={`/market/${sig.marketId}`} className="text-accent hover:underline font-medium">{mkt.ticker}</Link></td>
                    <td className="px-3 py-2 text-muted-foreground">{mkt.category}</td>
                    <td className="px-3 py-2 font-mono"><span className="text-profit">{qt.bestYesBid.toFixed(2)}</span>/<span className="text-loss">{qt.bestYesAsk.toFixed(2)}</span></td>
                    <td className="px-3 py-2 font-mono">{fmtC(qt.spread)}</td>
                    <td className="px-3 py-2"><span className={`font-bold ${sig.score >= 80 ? 'text-profit' : sig.score >= 70 ? 'text-warn' : 'text-muted-foreground'}`}>{sig.score}</span></td>
                    <td className="px-3 py-2 font-mono text-profit">{fmtC(sig.expectedNetEdge)}</td>
                    <td className="px-3 py-2">{sig.confidence}%</td>
                    <td className="px-3 py-2 text-muted-foreground">{sig.timeToExpiry}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${sig.action === 'wait' ? 'bg-muted text-muted-foreground' : sig.action === 'paper_buy_yes' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'}`}>{sig.action.replace('paper_', '').replace('_', ' ')}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
