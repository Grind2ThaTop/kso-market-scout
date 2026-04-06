import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, AlertTriangle, ExternalLink, TrendingUp, TrendingDown, MinusCircle, Search, Loader2 } from 'lucide-react';
import { useMarketScanner } from '@/hooks/useMarketScanner';
import { useIntegratedFeeModel } from '@/integrations/useIntegratedFeeModel';
import { buildOutcomeTradeUrl } from '@/lib/marketUrlBuilder';
import { getFreshnessStatus, freshnessColors } from '@/data/types';
import { firecrawlApi } from '@/lib/api/firecrawl';

const MarketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useMarketScanner();
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const { data: feeModel } = useIntegratedFeeModel();
  const [size, setSize] = useState(25);
  const [showPlaced, setShowPlaced] = useState(false);

  // Deep dive state
  const [deepDiveData, setDeepDiveData] = useState<string | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);

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

  // Profit scale for $1, $5, $10
  const stakes = [1, 5, 10];
  const calcProfit = (stake: number) => {
    const contracts = Math.floor(stake / entryPrice);
    if (contracts <= 0) return { contracts: 0, gross: 0, totalFees: 0, net: 0 };
    const gross = (targetExit - entryPrice) * contracts;
    const totalFees = (takerFee + slip) * contracts * 2;
    const net = gross - totalFees;
    return { contracts, gross, totalFees, net };
  };

  const cleanScrapedContent = (raw: string): string => {
    const lines = raw.split('\n');

    // Find start: first H1/H2 matching title, or "Market Rules"/"Resolution"
    const titleWords = market.title.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    let startIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      if (line.startsWith('#')) {
        const matchCount = titleWords.filter(w => line.includes(w)).length;
        if (matchCount >= Math.min(2, titleWords.length)) {
          startIdx = i;
          break;
        }
      }
    }

    if (startIdx === -1) {
      for (let i = 0; i < lines.length; i++) {
        if (/^#+\s*(market\s*rules|resolution|description|about)/i.test(lines[i].trim())) {
          startIdx = i;
          break;
        }
      }
    }

    if (startIdx === -1) return 'Could not extract meaningful market content. Try visiting the exchange page directly.';

    // Find end: cut at "People are also trading", "Ideas", "Activity", "Sign up", trade widget junk
    const stopPatterns = [
      /^#+\s*(people are also|ideas|activity|related markets)/i,
      /sign up to trade/i,
      /^##\s*buy\s+(yes|no)/i,
      /twitter widget/i,
      /show more/i,
    ];

    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (stopPatterns.some(p => p.test(t))) {
        endIdx = i;
        break;
      }
    }

    const relevant = lines.slice(startIdx, endIdx).join('\n');

    const cleaned = relevant
      .replace(/\[!\[.*?\]\(.*?\)\]/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]*)\]\(https?:\/\/[^)]*\)/g, '$1')
      .replace(/^\s*(Browse|Live\d*|Portfolio|Search|Loading more|Pick up to|Earn \d).*$/gm, '')
      .replace(/^(Yes|No)\d+¢$/gm, '')
      .replace(/^(Buy|Sell|Dollars)$/gm, '')
      .replace(/^Amount$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned || 'No meaningful content extracted.';
  };

  const handleDeepDive = async () => {
    if (!market.market_url) return;
    setDeepDiveLoading(true);
    setDeepDiveError(null);
    setDeepDiveData(null);
    try {
      const result = await firecrawlApi.scrape(market.market_url, {
        formats: ['markdown'],
        onlyMainContent: true,
      });
      if (result.success) {
        const md = result.data?.markdown || result.data?.data?.markdown || 'No content returned.';
        setDeepDiveData(cleanScrapedContent(md));
      } else {
        setDeepDiveError(result.error || 'Scrape failed');
      }
    } catch (e: any) {
      setDeepDiveError(e.message || 'Scrape request failed');
    } finally {
      setDeepDiveLoading(false);
    }
  };

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
          <h2 className="text-sm font-semibold text-foreground mb-3">Sharp Edge Analysis</h2>
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
          ) : <p className="text-xs text-muted-foreground">No edge signal — this market didn't pass the sharp filter.</p>}
        </div>
      </div>

      {/* Profit Scale */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Profit Scale (if target hit)</h2>
        <div className="grid grid-cols-3 gap-3">
          {stakes.map(stake => {
            const r = calcProfit(stake);
            return (
              <div key={stake} className="bg-surface-2 rounded-lg p-3 text-center">
                <div className="text-[10px] text-muted-foreground mb-1">@ ${stake} stake</div>
                <div className={`text-lg font-bold font-mono ${r.net >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {r.net >= 0 ? '+' : ''}${r.net.toFixed(2)}
                </div>
                <div className="text-[9px] text-muted-foreground mt-1">
                  {r.contracts} contracts · Fees: ${r.totalFees.toFixed(2)}
                </div>
              </div>
            );
          })}
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
          {market.market_url ? (
            <a href={buildOutcomeTradeUrl(market, side)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1 w-full py-2 bg-accent text-accent-foreground rounded font-semibold text-[11px] hover:bg-accent/90">
              <ExternalLink className="w-3 h-3" /> Trade on {market.platform}
            </a>
          ) : (
            <div className="flex items-center justify-center gap-1 w-full py-2 bg-muted text-muted-foreground rounded font-semibold text-[11px] cursor-not-allowed">
              <ExternalLink className="w-3 h-3" /> No exchange link available
            </div>
          )}
          {showPlaced && <div className="bg-primary/10 border border-primary/30 rounded p-2 text-[11px] text-primary">Paper plan saved locally.</div>}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><AlertTriangle className="w-3 h-3" />Fee source: {feeModel?.source ?? 'default config'}</div>
        </div>
      </div>

      {/* Firecrawl Deep Dive */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> Deep Dive — Live Market Intel
          </h2>
          <button
            onClick={handleDeepDive}
            disabled={deepDiveLoading}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {deepDiveLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            {deepDiveLoading ? 'Scraping...' : 'Scrape Market Page'}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Pulls real-time data from the exchange page — rules, comments, resolution criteria, volume history. Use this to validate your thesis before entering.
        </p>
        {deepDiveError && (
          <div className="bg-loss/10 border border-loss/30 rounded p-2 text-[11px] text-loss mb-3">{deepDiveError}</div>
        )}
        {deepDiveData && (
          <div className="bg-surface-2 rounded p-3 max-h-[400px] overflow-y-auto text-[11px] text-foreground whitespace-pre-wrap leading-relaxed font-mono">
            {deepDiveData}
          </div>
        )}
        {!deepDiveData && !deepDiveError && !deepDiveLoading && (
          <div className="text-[11px] text-muted-foreground italic">Click "Scrape Market Page" to pull live intel from {market.platform}.</div>
        )}
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
