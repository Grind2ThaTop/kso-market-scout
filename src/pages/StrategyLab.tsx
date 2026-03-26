import { FlaskConical, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

const StrategyLab = () => {
  const [weights, setWeights] = useState({ momentum: 25, imbalance: 25, liquidity: 20, spread: 20, eventTime: 10 });

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-primary" /> Strategy Lab
      </h1>

      <div className="bg-card border border-border rounded-lg p-4 max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Backtest datasets and strategy performance cards were removed because they were seeded sample values.
          Connect a real research/backtest service to re-enable this screen.
        </p>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-primary" /> Live Scoring Weights</h2>
          <div className="space-y-3">
            {Object.entries(weights).map(([key, val]) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="font-mono">{val}%</span>
                </div>
                <input type="range" min={0} max={60} value={val} onChange={(e) => setWeights((w) => ({ ...w, [key]: +e.target.value }))} className="w-full h-1 bg-surface-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyLab;
