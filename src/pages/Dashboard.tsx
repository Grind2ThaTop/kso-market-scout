import { tradingProfile, journalTrades, signals, quotes, markets } from '@/data/demoData';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Target, AlertTriangle, DollarSign, Activity, Zap, ExternalLink } from 'lucide-react';
import { buildOutcomeTradeUrl } from '@/lib/marketUrlBuilder';

const fmt = (n: number) => `$${n.toFixed(0)}`;
const fmtC = (n: number) => `${(n * 100).toFixed(1)}¢`;

const Dashboard = () => {
  const actionableMarkets = markets.filter((market) => market.market_url);
  const unlinkedMarketIds = new Set(markets.filter((market) => !market.market_url).map((market) => market.id));
  const actionableSignals = signals.filter((signal) => !unlinkedMarketIds.has(signal.marketId));

  const closedToday = journalTrades.filter(t => t.status === 'closed');
  const openTrades = journalTrades.filter(t => t.status === 'open');
  const realizedPnl = closedToday.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const unrealizedPnl = openTrades.reduce((s, t) => {
    const q = quotes.find(q => q.marketId === t.marketId);
    if (!q) return s;
    return s + (q.bestYesBid - t.entryPrice) * t.size;
  }, 0);
  const remaining = tradingProfile.dailyTarget - realizedPnl;
  const avgEdge = actionableSignals.filter(s => s.action !== 'wait').reduce((s, sig) => s + sig.expectedNetEdge, 0) / actionableSignals.filter(s => s.action !== 'wait').length;
  const tradesNeeded = Math.ceil(remaining / (avgEdge * 30));
  const drawdown = journalTrades.filter(t => t.status === 'stopped').reduce((s, t) => s + Math.abs(t.realizedPnl ?? 0), 0);
  const killSwitch = drawdown >= tradingProfile.maxDailyLoss;

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Daily Target', value: fmt(tradingProfile.dailyTarget), icon: Target, color: 'text-primary' },
          { label: 'Realized P&L', value: fmt(realizedPnl), icon: TrendingUp, color: realizedPnl >= 0 ? 'text-profit' : 'text-loss' },
          { label: 'Unrealized P&L', value: fmt(unrealizedPnl), icon: Activity, color: unrealizedPnl >= 0 ? 'text-profit' : 'text-loss' },
          { label: 'Remaining', value: fmt(remaining), icon: DollarSign, color: 'text-warn' },
          { label: 'Max Loss', value: fmt(tradingProfile.maxDailyLoss), icon: AlertTriangle, color: 'text-loss' },
          { label: 'Buying Power', value: fmt(tradingProfile.paperBuyingPower), icon: Zap, color: 'text-foreground' },
          { label: 'Drawdown', value: fmt(drawdown), icon: TrendingDown, color: drawdown > 100 ? 'text-loss' : 'text-muted-foreground' },
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

      {killSwitch && (
        <div className="bg-loss/10 border border-loss/30 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-loss" />
          <span className="text-sm font-medium text-loss">KILL SWITCH: Daily drawdown limit reached. Paper trading disabled.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Signals */}
        <div className="lg:col-span-2 glass-card border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Top Signals</h2>
            <span className="text-[10px] text-muted-foreground">Ranked by score</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {['Market', 'Platform', 'Setup', 'Bid/Ask', 'Spread', 'Score', 'Net Edge', 'Conf', 'Time', 'Trade'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actionableSignals.map(sig => {
                  const mkt = markets.find(m => m.id === sig.marketId);
                  const qt = quotes.find(q => q.marketId === sig.marketId);
                  if (!mkt?.market_url || !qt) return null;

                  return (
                    <tr key={sig.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                      <td className="px-3 py-2">
                        <Link to={`/market/${sig.marketId}`} className="text-accent hover:underline font-medium">{mkt?.ticker}</Link>
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 bg-surface-2 rounded uppercase text-[10px]">{mkt.platform}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{sig.setupType}</td>
                      <td className="px-3 py-2 font-mono">
                        <span className="text-profit">{qt?.bestYesBid.toFixed(2)}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-loss">{qt?.bestYesAsk.toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 font-mono">{fmtC(qt?.spread ?? 0)}</td>
                      <td className="px-3 py-2"><span className={`font-bold ${sig.score >= 80 ? 'text-profit' : sig.score >= 70 ? 'text-warn' : 'text-muted-foreground'}`}>{sig.score}</span></td>
                      <td className="px-3 py-2 font-mono text-profit">{fmtC(sig.expectedNetEdge)}</td>
                      <td className="px-3 py-2">{sig.confidence}%</td>
                      <td className="px-3 py-2 text-muted-foreground">{sig.timeToExpiry}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <a
                            href={buildOutcomeTradeUrl(mkt, 'yes')}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-profit/15 text-profit hover:bg-profit/25"
                          >
                            YES
                          </a>
                          <a
                            href={buildOutcomeTradeUrl(mkt, 'no')}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-loss/15 text-loss hover:bg-loss/25"
                          >
                            NO
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Today's Plan */}
          <div className="glass-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Today's Plan
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Target</span><span className="font-mono font-bold">{fmt(tradingProfile.dailyTarget)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Realized</span><span className="font-mono text-profit">{fmt(realizedPnl)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Remaining</span><span className="font-mono text-warn">{fmt(remaining)}</span></div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between"><span className="text-muted-foreground">Avg Net Edge/Trade</span><span className="font-mono">{fmt(avgEdge * 30)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Est. Winning Trades Needed</span><span className="font-mono font-bold text-accent">{tradesNeeded}</span></div>
              <div className="bg-surface-2 rounded p-2 mt-2">
                <p className="text-muted-foreground text-[11px]">
                  <strong className="text-foreground">Formula:</strong> Remaining Target ÷ (Avg Net Edge × Avg Size) = Trades Needed<br/>
                  {fmt(remaining)} ÷ {fmt(avgEdge * 30)} ≈ {tradesNeeded} trades
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (realizedPnl / tradingProfile.dailyTarget) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">{((realizedPnl / tradingProfile.dailyTarget) * 100).toFixed(0)}% of daily target</span>
            </div>
          </div>

          {/* Market Heatmap Mini */}
          <div className="glass-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Market Heatmap</h2>
            <div className="grid grid-cols-5 gap-1">
              {actionableMarkets.slice(0, 15).map(m => {
                const sig = signals.find(s => s.marketId === m.id);
                const intensity = sig ? sig.score / 100 : 0.3;
                return (
                  <a
                    key={m.id}
                    href={m.market_url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square rounded flex items-center justify-center text-[8px] font-mono font-bold hover:ring-1 ring-primary transition-all cursor-pointer"
                    style={{ backgroundColor: `hsl(var(--primary) / ${intensity * 0.4})`, color: intensity > 0.6 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
                    title={`View on ${m.platform} — ${m.ticker}`}
                  >
                    {m.ticker.split('-')[0]}
                  </a>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Brightness = signal score intensity</p>
          </div>

          {/* Risk Status */}
          <div className="glass-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warn" /> Risk Status
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Drawdown</span><span className={`font-mono ${drawdown > 100 ? 'text-loss' : 'text-foreground'}`}>{fmt(drawdown)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Max Daily Loss</span><span className="font-mono">{fmt(tradingProfile.maxDailyLoss)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Per-Trade Risk</span><span className="font-mono">{fmt(tradingProfile.perTradeRisk)}</span></div>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-loss rounded-full" style={{ width: `${Math.min(100, (drawdown / tradingProfile.maxDailyLoss) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{((drawdown / tradingProfile.maxDailyLoss) * 100).toFixed(0)}% of max loss used</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Paper Trades */}
      <div className="glass-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Paper Trades</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {['Time', 'Market', 'Setup', 'Entry', 'Exit', 'Size', 'P&L', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {journalTrades.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-surface-2">
                  <td className="px-3 py-2 text-muted-foreground font-mono">{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link to={`/market/${t.marketId}`} className="text-accent hover:underline">{t.marketTitle}</Link>
                      {markets.find((m) => m.id === t.marketId)?.market_url && (
                        <a
                          href={markets.find((m) => m.id === t.marketId)?.market_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          title="View live market"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px]">{t.setupType}</span></td>
                  <td className="px-3 py-2 font-mono">{t.entryPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono">{t.exitPrice?.toFixed(2) ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{t.size}</td>
                  <td className={`px-3 py-2 font-mono font-bold ${(t.realizedPnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{t.realizedPnl != null ? fmt(t.realizedPnl) : '—'}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${t.status === 'closed' ? 'bg-profit/15 text-profit' : t.status === 'stopped' ? 'bg-loss/15 text-loss' : 'bg-info/15 text-info'}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
