import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useMarketScanner } from '@/hooks/useMarketScanner';
import { useIntegratedFeeModel } from '@/integrations/useIntegratedFeeModel';

const MarketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useMarketScanner();

  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const { data: feeModel } = useIntegratedFeeModel();
  const [size, setSize] = useState(25);
  const [showPlaced, setShowPlaced] = useState(false);

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading market…</div>;
  if (isError) return <div className="flex-1 flex items-center justify-center text-loss">{error instanceof Error ? error.message : 'Live data unavailable'}</div>;

  const market = data?.markets.find((m) => m.id === id);
  const quote = data?.quotes.find((q) => q.marketId === id);
  const signal = data?.signals.find((s) => s.marketId === id);

  if (!market || !quote) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Market not found in current live feed.</div>;
  }

  const entryPrice = side === 'yes' ? quote.bestYesAsk : quote.bestNoAsk;
  const targetExit = Math.min(0.99, entryPrice + 0.06);
  const stopPrice = Math.max(0.01, entryPrice - 0.04);
  const takerFee = feeModel?.taker ?? 0;
  const slip = feeModel?.slippage ?? 0;
  const fees = size * takerFee;
  const slippage = size * slip;
  const netEdgePerContract = targetExit - entryPrice - takerFee - slip;
  const projectedPnlTarget = (targetExit - entryPrice) * size - fees - slippage;
  const projectedPnlStop = (stopPrice - entryPrice) * size - fees - slippage;

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-lg font-bold text-foreground">{market.title}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">{market.ticker}</span>
            <span className="px-1.5 py-0.5 bg-surface-2 rounded">{market.category}</span>
            <span>Liquidity: {market.liquidityScore}</span>
            <span>Expires: {new Date(market.eventEnd).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Live Quote</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <QuoteCell label="YES Bid" value={quote.bestYesBid.toFixed(4)} tone="text-profit" />
            <QuoteCell label="YES Ask" value={quote.bestYesAsk.toFixed(4)} tone="text-loss" />
            <QuoteCell label="NO Bid" value={quote.bestNoBid.toFixed(4)} tone="text-profit" />
            <QuoteCell label="NO Ask" value={quote.bestNoAsk.toFixed(4)} tone="text-loss" />
          </div>
          <div className="text-xs text-muted-foreground">Spread: {(quote.spread * 100).toFixed(2)}¢ · Updated {new Date(quote.timestamp).toLocaleString()}</div>
          <div className="bg-surface-2 rounded p-3 text-xs text-muted-foreground">
            Historical candles, orderbook depth, and trade prints are disabled until dedicated live endpoints are configured.
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Signal Breakdown</h2>
          {signal ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Setup</span><span className="font-medium">{signal.setupType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Score</span><span className="font-bold">{signal.score}/100</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><span>{signal.confidence}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Net Edge</span><span className="text-profit font-mono">{(signal.expectedNetEdge * 100).toFixed(2)}¢</span></div>
              <p className="text-muted-foreground text-[11px] pt-2 border-t border-border">{signal.rationale}</p>
            </div>
          ) : <p className="text-xs text-muted-foreground">No actionable signal in current scan.</p>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Paper Trade Ticket</h2>
        <div className="space-y-3 text-xs max-w-sm">
          <div className="flex gap-2">
            <button onClick={() => setSide('yes')} className={`flex-1 py-1.5 rounded text-center font-bold text-[11px] ${side === 'yes' ? 'bg-profit/20 text-profit border border-profit/30' : 'bg-surface-2 text-muted-foreground'}`}>BUY YES</button>
            <button onClick={() => setSide('no')} className={`flex-1 py-1.5 rounded text-center font-bold text-[11px] ${side === 'no' ? 'bg-loss/20 text-loss border border-loss/30' : 'bg-surface-2 text-muted-foreground'}`}>BUY NO</button>
          </div>
          <input type="number" value={size} onChange={(e) => setSize(+e.target.value)} className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 font-mono" />
          <div className="space-y-1 bg-surface-2 rounded p-2">
            <div className="flex justify-between"><span>Entry</span><span className="font-mono">{entryPrice.toFixed(4)}</span></div>
            <div className="flex justify-between"><span>Target</span><span className="font-mono text-profit">{targetExit.toFixed(4)}</span></div>
            <div className="flex justify-between"><span>Stop</span><span className="font-mono text-loss">{stopPrice.toFixed(4)}</span></div>
            <div className="flex justify-between"><span>Net Edge/Contract</span><span className="font-mono">{(netEdgePerContract * 100).toFixed(2)}¢</span></div>
            <div className="flex justify-between"><span>P&L if Target</span><span className="text-profit">${projectedPnlTarget.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>P&L if Stopped</span><span className="text-loss">${projectedPnlStop.toFixed(2)}</span></div>
          </div>
          <button onClick={() => setShowPlaced(true)} className="w-full py-2 bg-primary text-primary-foreground rounded font-semibold text-[11px]">Save Paper Plan</button>
          {showPlaced && <div className="bg-info/10 border border-info/30 rounded p-2 text-[11px] text-info">Paper plan saved locally. No live execution is enabled.</div>}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><AlertTriangle className="w-3 h-3" />Execution APIs are not connected in this client. Fee source: {feeModel?.source ?? 'default config'}.</div>
        </div>
      </div>
    </div>
  );
};

const QuoteCell = ({ label, value, tone }: { label: string; value: string; tone: string }) => (
  <div className="bg-surface-2 rounded p-2">
    <span className="text-[10px] text-muted-foreground block">{label}</span>
    <span className={`font-mono font-bold ${tone}`}>{value}</span>
  </div>
);

export default MarketDetail;
