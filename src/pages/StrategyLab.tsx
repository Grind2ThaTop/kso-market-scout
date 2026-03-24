import { strategies, backtestRuns } from '@/data/demoData';
import { useState } from 'react';
import { FlaskConical, CheckCircle, XCircle, SlidersHorizontal } from 'lucide-react';

const StrategyLab = () => {
  const [selectedId, setSelectedId] = useState(strategies[0].id);
  const selected = strategies.find(s => s.id === selectedId)!;
  const bt = backtestRuns.find(b => b.strategyName === selected.name);

  const [weights, setWeights] = useState({
    momentum: 25, imbalance: 20, liquidity: 15, spread: 15, volatility: 15, eventTime: 10,
  });

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-primary" /> Strategy Lab
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Strategy list */}
        <div className="space-y-2">
          {strategies.map(s => (
            <button key={s.id} onClick={() => setSelectedId(s.id)} className={`w-full text-left px-3 py-3 rounded-lg border text-xs transition-colors ${s.id === selectedId ? 'bg-card border-primary/30' : 'bg-card border-border hover:border-primary/20'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-foreground">{s.name}</span>
                {s.enabled ? <CheckCircle className="w-3.5 h-3.5 text-profit" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <span className="text-muted-foreground">{s.sampleMetrics.winRate * 100}% WR · ${s.sampleMetrics.netPnl}</span>
            </button>
          ))}
        </div>

        {/* Strategy detail */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">{selected.name}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selected.enabled ? 'bg-profit/15 text-profit' : 'bg-muted text-muted-foreground'}`}>
                {selected.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{selected.description}</p>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Rules</span>
              {selected.rules.map((r, i) => (
                <div key={i} className="text-xs text-foreground bg-surface-2 rounded px-2 py-1.5 font-mono">{i + 1}. {r}</div>
              ))}
            </div>
          </div>

          {bt && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Backtest Results</h2>
              <p className="text-[10px] text-muted-foreground mb-3">{bt.dateRange} · Seeded sample data</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Trades', value: bt.metrics.totalTrades.toString() },
                  { label: 'Win Rate', value: `${(bt.metrics.winRate * 100).toFixed(0)}%`, color: bt.metrics.winRate > 0.55 ? 'text-profit' : '' },
                  { label: 'Avg Winner', value: `$${bt.metrics.avgWinner.toFixed(2)}`, color: 'text-profit' },
                  { label: 'Avg Loser', value: `$${bt.metrics.avgLoser.toFixed(2)}`, color: 'text-loss' },
                  { label: 'Net P&L', value: `$${bt.metrics.netPnl}`, color: bt.metrics.netPnl > 0 ? 'text-profit' : 'text-loss' },
                  { label: 'Sharpe', value: bt.metrics.sharpe.toFixed(2) },
                  { label: 'Max Drawdown', value: `$${bt.metrics.maxDrawdown}`, color: 'text-loss' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-xs">
                    <span className="text-muted-foreground block text-[10px]">{label}</span>
                    <span className={`font-mono font-bold ${color ?? ''}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Thresholds</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {Object.entries(selected.thresholds).map(([k, v]) => (
                <div key={k} className="flex justify-between bg-surface-2 rounded px-2 py-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scoring Model Editor */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" /> Scoring Weights
          </h2>
          <p className="text-[10px] text-muted-foreground mb-4">Adjust signal scoring model weights (must sum to 100)</p>
          <div className="space-y-3">
            {Object.entries(weights).map(([key, val]) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="font-mono">{val}%</span>
                </div>
                <input type="range" min={0} max={50} value={val} onChange={e => setWeights(w => ({ ...w, [key]: +e.target.value }))} className="w-full h-1 bg-surface-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary" />
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className={`font-mono font-bold ${Object.values(weights).reduce((a, b) => a + b, 0) === 100 ? 'text-profit' : 'text-loss'}`}>
                {Object.values(weights).reduce((a, b) => a + b, 0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyLab;
