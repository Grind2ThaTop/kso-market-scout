import { useParams, Link } from 'react-router-dom';
import { markets, quotes, signals, generateOrderBook, generatePriceHistory, generateTradePrints, tradingProfile } from '@/data/demoData';
import { useState, useMemo } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const MarketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const market = markets.find(m => m.id === id);
  const quote = quotes.find(q => q.marketId === id);
  const signal = signals.find(s => s.marketId === id);
  const orderBook = useMemo(() => generateOrderBook(id!), [id]);
  const priceHistory = useMemo(() => generatePriceHistory(id!), [id]);
  const tradePrints = useMemo(() => generateTradePrints(id!), [id]);

  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [size, setSize] = useState(25);
  const entryPrice = side === 'yes' ? (quote?.bestYesAsk ?? 0.50) : (quote?.bestNoAsk ?? 0.50);
  const targetExit = side === 'yes' ? Math.min(0.99, entryPrice + 0.06) : Math.min(0.99, entryPrice + 0.06);
  const stopPrice = Math.max(0.01, entryPrice - 0.04);
  const fees = size * tradingProfile.feeModel.taker;
  const slippage = size * tradingProfile.slippageModel;
  const netEdgePerContract = targetExit - entryPrice - tradingProfile.feeModel.taker - tradingProfile.slippageModel;
  const projectedPnlTarget = (targetExit - entryPrice) * size - fees - slippage;
  const projectedPnlStop = (stopPrice - entryPrice) * size - fees - slippage;
  const maxLoss = Math.abs(projectedPnlStop);
  const suggestedSize = Math.floor(tradingProfile.perTradeRisk / (entryPrice - stopPrice + tradingProfile.feeModel.taker + tradingProfile.slippageModel));
  const [showPlaced, setShowPlaced] = useState(false);

  if (!market || !quote) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Market not found</div>;
  }

  const bids = orderBook.filter(l => l.side === 'yes').sort((a, b) => b.price - a.price);
  const asks = orderBook.filter(l => l.side === 'no').sort((a, b) => a.price - b.price);

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
            <span>Expires: {new Date(market.eventEnd).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Price Chart (48h)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={priceHistory}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v * 100).toFixed(0)}¢`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12, borderRadius: 6 }} formatter={(v: number) => [`${(v * 100).toFixed(1)}¢`, 'Price']} labelFormatter={l => new Date(l).toLocaleString()} />
              <ReferenceLine y={quote.bestYesBid} stroke="hsl(var(--profit))" strokeDasharray="3 3" />
              <ReferenceLine y={quote.bestYesAsk} stroke="hsl(var(--loss))" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="price" stroke="hsl(var(--accent))" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Depth Ladder */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Depth Ladder</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground mb-1 text-[10px] uppercase">Bids (YES)</div>
              {bids.map((l, i) => (
                <div key={i} className="flex justify-between font-mono py-0.5">
                  <span className="text-profit">{l.price.toFixed(2)}</span>
                  <span className="text-muted-foreground">{l.size}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-muted-foreground mb-1 text-[10px] uppercase">Asks (NO)</div>
              {asks.map((l, i) => (
                <div key={i} className="flex justify-between font-mono py-0.5">
                  <span className="text-loss">{l.price.toFixed(2)}</span>
                  <span className="text-muted-foreground">{l.size}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Best YES Bid</span><span className="font-mono text-profit">{quote.bestYesBid.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Best YES Ask</span><span className="font-mono text-loss">{quote.bestYesAsk.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Spread</span><span className="font-mono">{(quote.spread * 100).toFixed(1)}¢</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trade Tape */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Rolling Trades</h2>
          <div className="space-y-1 max-h-48 overflow-auto text-xs font-mono">
            {tradePrints.map((tp, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span className="text-muted-foreground">{new Date(tp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span className={tp.side === 'yes' ? 'text-profit' : 'text-loss'}>{tp.side.toUpperCase()}</span>
                <span>{tp.price.toFixed(2)}</span>
                <span className="text-muted-foreground">×{tp.size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signal Scorecard */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Signal Breakdown</h2>
          {signal ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Setup</span><span className="font-medium">{signal.setupType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Score</span><span className={`font-bold ${signal.score >= 80 ? 'text-profit' : 'text-warn'}`}>{signal.score}/100</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Momentum</span><MiniBar value={signal.momentum} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Imbalance</span><MiniBar value={signal.imbalance} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><span>{signal.confidence}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Net Edge</span><span className="text-profit font-mono">{(signal.expectedNetEdge * 100).toFixed(1)}¢</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Action</span><span className={`font-bold uppercase ${signal.action === 'wait' ? '' : signal.action.includes('yes') ? 'text-profit' : 'text-loss'}`}>{signal.action.replace('paper_', '').replace('_', ' ')}</span></div>
              <p className="text-muted-foreground text-[11px] pt-2 border-t border-border">{signal.rationale}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No active signal for this market.</p>
          )}
        </div>

        {/* Trade Calculator / Order Ticket */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Paper Trade Ticket</h2>
          <div className="space-y-3 text-xs">
            <div className="flex gap-2">
              <button onClick={() => setSide('yes')} className={`flex-1 py-1.5 rounded text-center font-bold text-[11px] transition-colors ${side === 'yes' ? 'bg-profit/20 text-profit border border-profit/30' : 'bg-surface-2 text-muted-foreground'}`}>BUY YES</button>
              <button onClick={() => setSide('no')} className={`flex-1 py-1.5 rounded text-center font-bold text-[11px] transition-colors ${side === 'no' ? 'bg-loss/20 text-loss border border-loss/30' : 'bg-surface-2 text-muted-foreground'}`}>BUY NO</button>
            </div>
            <div>
              <label className="text-muted-foreground text-[10px]">Size (contracts)</label>
              <input type="number" value={size} onChange={e => setSize(+e.target.value)} className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 font-mono text-foreground mt-1" />
            </div>
            <div className="space-y-1 bg-surface-2 rounded p-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Entry</span><span className="font-mono">{entryPrice.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Target Exit</span><span className="font-mono text-profit">{targetExit.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Stop</span><span className="font-mono text-loss">{stopPrice.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Est. Fee</span><span className="font-mono">${fees.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Est. Slippage</span><span className="font-mono">${slippage.toFixed(2)}</span></div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between"><span className="text-muted-foreground">Net Edge/Contract</span><span className="font-mono text-profit">{(netEdgePerContract * 100).toFixed(1)}¢</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Suggested Size</span><span className="font-mono">{suggestedSize}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Max Loss</span><span className="font-mono text-loss">${maxLoss.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold"><span className="text-foreground">P&L if Target</span><span className="text-profit">${projectedPnlTarget.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold"><span className="text-foreground">P&L if Stopped</span><span className="text-loss">${projectedPnlStop.toFixed(2)}</span></div>
            </div>
            <div className="bg-surface-2 rounded p-2 text-[10px] text-muted-foreground">
              <strong className="text-foreground">Formula:</strong> Net Edge = Exit − Entry − Fee − Slippage<br />
              {(netEdgePerContract * 100).toFixed(1)}¢ = {(targetExit * 100).toFixed(0)}¢ − {(entryPrice * 100).toFixed(0)}¢ − {(tradingProfile.feeModel.taker * 100).toFixed(0)}¢ − {(tradingProfile.slippageModel * 100).toFixed(0)}¢
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPlaced(true)} className="flex-1 py-2 bg-primary text-primary-foreground rounded font-semibold text-[11px] hover:opacity-90 transition-opacity">
                Place Paper Trade
              </button>
              <button className="py-2 px-3 bg-surface-2 text-muted-foreground rounded text-[11px] hover:text-foreground transition-colors">
                Save Alert
              </button>
            </div>
            {showPlaced && (
              <div className="bg-profit/10 border border-profit/30 rounded p-2 text-[11px] text-profit flex items-center gap-2">
                ✓ Paper trade placed (simulation only)
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <AlertTriangle className="w-3 h-3" />
              No live orders. Simulation only.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MiniBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="w-16 h-1.5 bg-surface-2 rounded-full overflow-hidden">
      <div className="h-full bg-accent rounded-full" style={{ width: `${value * 100}%` }} />
    </div>
    <span className="font-mono text-[10px]">{(value * 100).toFixed(0)}%</span>
  </div>
);

export default MarketDetail;
