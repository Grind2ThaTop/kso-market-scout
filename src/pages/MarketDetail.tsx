import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, AlertTriangle, ExternalLink, TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';
import { useMarketScanner } from '@/hooks/useMarketScanner';
import { useIntegratedFeeModel } from '@/integrations/useIntegratedFeeModel';
import { buildOutcomeTradeUrl } from '@/lib/marketUrlBuilder';
import { getFreshnessStatus, freshnessColors } from '@/data/types';

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

  if (!market || !quote || !market.market_url) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Market not found or not actionable.</div>;
  }

  const freshness = getFreshnessStatus(market.lastUpdated);
  const entryPrice = side === 'yes' ? quote.bestYesAsk : quote.bestNoAsk;
  const targetExit = signal ? signal.targetPrice : Math.min(0.99, entryPrice + 0.06);
  const stopPrice = signal ? signal.invalidationPrice : Math.max(0.01, entryPrice - 0.04);
  const takerFee = feeModel?.taker ?? 0;
  const slip = feeModel?.slippage ?? 0;
  const fees = size * takerFee;
  const slippage = size * slip;
  const netEdgePerContract = targetExit - entryPrice - takerFee - slip;
  const projectedPnlTarget = (targetExit - entryPrice) * size - fees - slippage;
  const projectedPnlStop = (stopPrice - entryPrice) * size - fees - slippage;

  const DirectionBadge = () => {
    if (!signal) return null;
    const color = signal.direction === 'YES' ? 'text-profit' : signal.direction === 'NO' ? 'text-loss' : 'text-muted-foreground';
    const Icon = signal.direction === 'YES' ? TrendingUp : signal.direction === 'NO' ? TrendingDown : MinusCircle;
    return (
      <span className={`flex items-center gap-1 font-bold ${color}`}>
        <Icon className="w-4 h-4" /> {signal.direction}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">{market.title}</h1>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${freshnessColors[freshness]}`}>{freshness}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="font-mono">{market.ticker}</span>
            <span className="px-1.5 py-0.5 bg-surface-2 rounded capitalize">{market.category}</span>
            <span>Liq: {market.liquidityScore}</span>
            <span>Vol 24h: ${market.volume24h.toLocaleString()}</span>
            <span>Exp: {new Date(market.eventEnd).toLocaleString()}</span>
            <span>Updated: {new Date(market.lastUpdated).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quote panel */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Live Quote</h2>
          {data?.source === 'demo' && (
            <div className="bg-warning/10 border border-warning/30 rounded p-2 text-[11px] text-warning">
              Demo mode active. Prices are simulated.
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <QuoteCell label="YES Bid" value={`${(quote.bestYesBid * 100).toFixed(1)}¢`} tone="text-profit" />
            <QuoteCell label="YES Ask" value={`${(quote.bestYesAsk * 100).toFixed(1)}¢`} tone="text-loss" />
            <QuoteCell label="NO Bid" value={`${(quote.bestNoBid * 100).toFixed(1)}¢`} tone="text-profit" />
            <QuoteCell label="NO Ask" value={`${(quote.bestNoAsk * 100).toFixed(1)}¢`} tone="text-loss" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <QuoteCell label="Implied YES" value={`${market.impliedProbYes}%`} tone="text-foreground" />
            <QuoteCell label="Implied NO" value={`${market.impliedProbNo}%`} tone="text-foreground" />
            <QuoteCell label="Spread" value={`${(quote.spread * 100).toFixed(1)}¢`} tone="text-muted-foreground" />
            <QuoteCell label="Volume 24h" value={`$${market.volume24h.toLocaleString()}`} tone="text-muted-foreground" />
          </div>
        </div>

        {/* Signal panel */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Signal Analysis</h2>
          {signal ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <DirectionBadge />
                <span className="text-[10px] text-muted-foreground">{signal.setupType}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Score</span><span className="font-bold">{signal.score}/100</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><span>{signal.confidence}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Risk:Reward</span><span className="font-mono">{signal.riskReward.toFixed(1)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Catalyst</span><span>{signal.catalystStrength}/100</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sentiment</span>
                  <span className={signal.sentimentBias === 'bullish' ? 'text-profit' : signal.sentimentBias === 'bearish' ? 'text-loss' : 'text-muted-foreground'}>
                    {signal.sentimentBias}
                  </span>
                </div>
              </div>
              {signal.direction !== 'PASS' && (
                <div className="bg-surface-2 rounded p-2 space-y-1 font-mono text-[10px]">
                  <div className="flex justify-between"><span>Entry Zone</span><span>{(signal.entryZone[0] * 100).toFixed(0)}-{(signal.entryZone[1] * 100).toFixed(0)}¢</span></div>
                  <div className="flex justify-between"><span>Target</span><span className="text-profit">{(signal.targetPrice * 100).toFixed(0)}¢</span></div>
                  <div className="flex justify-between"><span>Invalidation</span><span className="text-loss">{(signal.invalidationPrice * 100).toFixed(0)}¢</span></div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground leading-snug pt-2 border-t border-border">{signal.thesis}</p>
              {signal.smartMoneyFlag && (
                <span className="inline-block px-1.5 py-0.5 bg-primary/20 text-primary rounded text-[9px] font-bold">🐋 Smart Money Detected</span>
              )}
            </div>
          ) : <p className="text-xs text-muted-foreground">No signal generated for this market.</p>}
        </div>
      </div>

      {/* Paper trade ticket */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Paper Trade Ticket</h2>
        <div className="space-y-3 text-xs max-w-sm">
          <div className="flex gap-2">
            <button onClick={() => setSide('yes')} className={`flex-1 py-1.5 rounded text-center font-bold text-[11px] ${side === 'yes' ? 'bg-profit/20 text-profit border border-profit/30' : 'bg-surface-2 text-muted-foreground'}`}>BUY YES</button>
            <button onClick={() => setSide('no')} className={`flex-1 py-1.5 rounded text-center font-bold text-[11px] ${side === 'no' ? 'bg-loss/20 text-loss border border-loss/30' : 'bg-surface-2 text-muted-foreground'}`}>BUY NO</button>
          </div>
          <input type="number" value={size} onChange={(e) => setSize(+e.target.value)} className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 font-mono" />
          <div className="space-y-1 bg-surface-2 rounded p-2">
            <div className="flex justify-between"><span>Entry</span><span className="font-mono">{(entryPrice * 100).toFixed(1)}¢</span></div>
            <div className="flex justify-between"><span>Target</span><span className="font-mono text-profit">{(targetExit * 100).toFixed(1)}¢</span></div>
            <div className="flex justify-between"><span>Stop</span><span className="font-mono text-loss">{(stopPrice * 100).toFixed(1)}¢</span></div>
            <div className="flex justify-between"><span>Net Edge/Contract</span><span className="font-mono">{(netEdgePerContract * 100).toFixed(2)}¢</span></div>
            <div className="flex justify-between"><span>P&L if Target</span><span className="text-profit">${projectedPnlTarget.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>P&L if Stopped</span><span className="text-loss">${projectedPnlStop.toFixed(2)}</span></div>
          </div>
          <button onClick={() => setShowPlaced(true)} className="w-full py-2 bg-primary text-primary-foreground rounded font-semibold text-[11px]">Save Paper Plan</button>
          <a href={buildOutcomeTradeUrl(market, side)} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1 w-full py-2 bg-accent text-accent-foreground rounded font-semibold text-[11px] hover:bg-accent/90">
            <ExternalLink className="w-3 h-3" /> Trade on {market.platform}
          </a>
          {showPlaced && <div className="bg-primary/10 border border-primary/30 rounded p-2 text-[11px] text-primary">Paper plan saved locally.</div>}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><AlertTriangle className="w-3 h-3" />Fee source: {feeModel?.source ?? 'default config'}</div>
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
