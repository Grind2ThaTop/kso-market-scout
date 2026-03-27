import { FlaskConical, SlidersHorizontal, BarChart3, Target, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useMarketScanner } from '@/hooks/useMarketScanner';
import { DEMO_STRATEGIES, DEMO_BACKTESTS } from '@/data/demoData';

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtC = (n: number) => `${(n * 100).toFixed(0)}¢`;

const StrategyLab = () => {
  const { data } = useMarketScanner();
  const [selectedMarketId, setSelectedMarketId] = useState<string>('');
  const [selectedStrategyId, setSelectedStrategyId] = useState(DEMO_STRATEGIES[0]?.id ?? '');
  const [simEntry, setSimEntry] = useState(0.50);
  const [simExit, setSimExit] = useState(0.60);
  const [simSize, setSimSize] = useState(25);
  const [simSide, setSimSide] = useState<'YES' | 'NO'>('YES');

  const markets = data?.markets ?? [];
  const signals = data?.signals ?? [];
  const selectedMarket = markets.find(m => m.id === selectedMarketId) || markets[0];
  const selectedSignal = signals.find(s => s.marketId === selectedMarket?.id);
  const strategy = DEMO_STRATEGIES.find(s => s.id === selectedStrategyId) || DEMO_STRATEGIES[0];

  // Sim calculations
  const fees = simSize * 0.03;
  const slippage = simSize * 0.01;
  const grossPnl = (simExit - simEntry) * simSize;
  const netPnl = grossPnl - fees - slippage;
  const riskReward = simEntry - 0.05 > 0 ? ((simExit - simEntry) / (simEntry - Math.max(0.01, simEntry - 0.06))).toFixed(2) : '—';
  const breakEven = +(simEntry + (fees + slippage) / simSize).toFixed(4);

  // Strategy match scan
  const strategyMatches = useMemo(() => {
    if (!strategy || !signals.length) return [];
    return signals
      .filter(s => s.direction !== 'PASS' && s.score > 50)
      .slice(0, 8)
      .map(s => {
        const mkt = markets.find(m => m.id === s.marketId);
        return { signal: s, market: mkt };
      })
      .filter(r => r.market);
  }, [strategy, signals, markets]);

  const backtest = DEMO_BACKTESTS.find(b => b.strategyName === strategy?.name);

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-primary" /> Strategy Lab
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Strategy selector + rules */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-primary" /> Strategy</h2>
          <select value={selectedStrategyId} onChange={e => setSelectedStrategyId(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded px-2 py-2 text-xs">
            {DEMO_STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.name}{!s.enabled ? ' (disabled)' : ''}</option>)}
          </select>
          {strategy && (
            <>
              <p className="text-xs text-muted-foreground">{strategy.description}</p>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Rules</span>
                {strategy.rules.map((r, i) => (
                  <div key={i} className="text-[11px] text-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span> {r}
                  </div>
                ))}
              </div>
              {!strategy.enabled && (
                <div className="flex items-center gap-1.5 text-[10px] text-warning">
                  <AlertTriangle className="w-3 h-3" /> Strategy disabled — signals won't fire
                </div>
              )}
            </>
          )}
        </div>

        {/* Trade simulator */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Trade Simulator</h2>
          <select value={selectedMarketId || selectedMarket?.id || ''} onChange={e => setSelectedMarketId(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded px-2 py-2 text-xs">
            {markets.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>

          <div className="flex gap-2">
            <button onClick={() => setSimSide('YES')}
              className={`flex-1 py-1.5 rounded text-center font-bold text-[11px] ${simSide === 'YES' ? 'bg-profit/20 text-profit border border-profit/30' : 'bg-surface-2 text-muted-foreground'}`}>YES</button>
            <button onClick={() => setSimSide('NO')}
              className={`flex-1 py-1.5 rounded text-center font-bold text-[11px] ${simSide === 'NO' ? 'bg-loss/20 text-loss border border-loss/30' : 'bg-surface-2 text-muted-foreground'}`}>NO</button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] text-muted-foreground">Entry
              <input type="number" step="0.01" min="0.01" max="0.99" value={simEntry} onChange={e => setSimEntry(+e.target.value)}
                className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 font-mono text-xs mt-0.5" />
            </label>
            <label className="text-[10px] text-muted-foreground">Exit
              <input type="number" step="0.01" min="0.01" max="0.99" value={simExit} onChange={e => setSimExit(+e.target.value)}
                className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 font-mono text-xs mt-0.5" />
            </label>
            <label className="text-[10px] text-muted-foreground">Size
              <input type="number" step="1" min="1" value={simSize} onChange={e => setSimSize(+e.target.value)}
                className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 font-mono text-xs mt-0.5" />
            </label>
          </div>

          <div className="bg-surface-2 rounded p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross P&L</span><span className={`font-mono ${grossPnl >= 0 ? 'text-profit' : 'text-loss'}`}>${grossPnl.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fees</span><span className="font-mono">-${fees.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Slippage</span><span className="font-mono">-${slippage.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-border pt-1"><span className="font-semibold">Net P&L</span><span className={`font-mono font-bold ${netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>${netPnl.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Break-even</span><span className="font-mono">{fmtC(breakEven)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Risk:Reward</span><span className="font-mono">{riskReward}</span></div>
          </div>

          {selectedSignal && (
            <div className="bg-primary/5 border border-primary/20 rounded p-2 text-[11px] space-y-1">
              <span className="font-semibold text-primary">Signal: {selectedSignal.direction}</span>
              <p className="text-muted-foreground">{selectedSignal.thesis}</p>
              <div className="font-mono text-[10px]">
                Entry: {fmtC(selectedSignal.entryZone[0])}-{fmtC(selectedSignal.entryZone[1])} · T: {fmtC(selectedSignal.targetPrice)} · ✕{fmtC(selectedSignal.invalidationPrice)}
              </div>
            </div>
          )}
        </div>

        {/* Backtest results */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Backtest Results</h2>
          {backtest ? (
            <div className="space-y-2 text-xs">
              <div className="text-[10px] text-muted-foreground">{backtest.dateRange}</div>
              {[
                { label: 'Total Trades', value: backtest.metrics.totalTrades.toString() },
                { label: 'Win Rate', value: fmtPct(backtest.metrics.winRate), color: backtest.metrics.winRate > 0.5 ? 'text-profit' : 'text-loss' },
                { label: 'Avg Winner', value: `$${backtest.metrics.avgWinner.toFixed(2)}`, color: 'text-profit' },
                { label: 'Avg Loser', value: `$${backtest.metrics.avgLoser.toFixed(2)}`, color: 'text-loss' },
                { label: 'Net P&L', value: `$${backtest.metrics.netPnl.toFixed(2)}`, color: backtest.metrics.netPnl > 0 ? 'text-profit' : 'text-loss' },
                { label: 'Sharpe', value: backtest.metrics.sharpe.toFixed(2), color: backtest.metrics.sharpe > 1.5 ? 'text-profit' : 'text-muted-foreground' },
                { label: 'Max Drawdown', value: `$${backtest.metrics.maxDrawdown.toFixed(2)}`, color: 'text-loss' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-mono ${color ?? ''}`}>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No backtest data for this strategy. Connect a backtest engine to generate historical performance metrics.</p>
          )}
        </div>
      </div>

      {/* Strategy-matched markets */}
      {strategyMatches.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Markets Matching: {strategy?.name}</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {['Signal', 'Market', 'Score', 'Conf', 'Entry', 'Target', 'R:R', 'Exp'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {strategyMatches.map(({ signal: s, market: m }) => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-surface-2">
                  <td className={`px-3 py-2 font-bold ${s.direction === 'YES' ? 'text-profit' : 'text-loss'}`}>
                    {s.direction === 'YES' ? <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> : <TrendingDown className="w-3.5 h-3.5 inline mr-1" />}
                    {s.direction}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[200px]">{m?.title}</td>
                  <td className="px-3 py-2 font-mono">{s.score}</td>
                  <td className="px-3 py-2">{s.confidence}%</td>
                  <td className="px-3 py-2 font-mono">{fmtC(s.entryZone[0])}-{fmtC(s.entryZone[1])}</td>
                  <td className="px-3 py-2 font-mono text-profit">{fmtC(s.targetPrice)}</td>
                  <td className="px-3 py-2 font-mono">{s.riskReward.toFixed(1)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.timeToExpiry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StrategyLab;
