import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Target, AlertTriangle, DollarSign, Activity, WifiOff, ArrowUpRight, ArrowDownRight, MinusCircle, Zap, Clock, Filter } from 'lucide-react';
import { useMarketScanner } from '@/hooks/useMarketScanner';
import { scannerConfig } from '@/data/liveApi';
import { buildOutcomeTradeUrl } from '@/lib/marketUrlBuilder';
import { getFreshnessStatus, freshnessColors, SignalDirection } from '@/data/types';

const fmt = (n: number) => `$${n.toFixed(0)}`;
const fmtC = (n: number) => `${(n * 100).toFixed(1)}¢`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

type SortKey = 'market' | 'platform' | 'direction' | 'yesPrice' | 'spread' | 'score' | 'confidence' | 'time' | 'volume' | 'rr';
type FilterDirection = 'ALL' | SignalDirection;
type FilterCategory = 'all' | 'sports' | 'politics' | 'economics' | 'weather' | 'culture' | 'crypto' | 'tech' | 'science' | 'entertainment' | 'finance' | 'health' | 'legal' | 'other';

const directionIcon = (d: SignalDirection) => {
  if (d === 'YES') return <ArrowUpRight className="w-3.5 h-3.5" />;
  if (d === 'NO') return <ArrowDownRight className="w-3.5 h-3.5" />;
  return <MinusCircle className="w-3.5 h-3.5" />;
};

const directionColor = (d: SignalDirection) => {
  if (d === 'YES') return 'text-profit';
  if (d === 'NO') return 'text-loss';
  return 'text-muted-foreground';
};

const timeToHours = (value: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  if (value.toLowerCase() === 'expired') return Number.NEGATIVE_INFINITY;
  if (value.toLowerCase() === 'unknown') return Number.POSITIVE_INFINITY;
  const match = value.match(/^(\d+)([mhd])$/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const amount = Number(match[1]);
  if (match[2] === 'm') return amount / 60;
  return match[2].toLowerCase() === 'd' ? amount * 24 : amount;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, isError, error, refetch } = useMarketScanner();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterDirection, setFilterDirection] = useState<FilterDirection>('ALL');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  // All hooks MUST be above early returns
  const signals = data?.signals ?? [];
  const markets = data?.markets ?? [];
  const quotes = data?.quotes ?? [];

  const actionableSignals = useMemo(() => {
    let filtered = signals.filter((signal) => {
      if (signal.direction === 'PASS') return false;
      const market = markets.find(m => m.id === signal.marketId);
      return market?.market_url;
    });
    if (filterDirection !== 'ALL') {
      filtered = filtered.filter(s => s.direction === filterDirection);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => {
        const market = markets.find(m => m.id === s.marketId);
        return market?.category === filterCategory;
      });
    }
    return filtered;
  }, [signals, markets, filterDirection, filterCategory]);

  const sortedSignals = useMemo(() => {
    const copy = [...actionableSignals];
    copy.sort((a, b) => {
      const marketA = markets.find((m) => m.id === a.marketId);
      const marketB = markets.find((m) => m.id === b.marketId);
      const quoteA = quotes.find((q) => q.marketId === a.marketId);
      const quoteB = quotes.find((q) => q.marketId === b.marketId);

      let result = 0;
      switch (sortKey) {
        case 'market': result = (marketA?.ticker ?? '').localeCompare(marketB?.ticker ?? ''); break;
        case 'platform': result = (marketA?.platform ?? '').localeCompare(marketB?.platform ?? ''); break;
        case 'direction': result = a.direction.localeCompare(b.direction); break;
        case 'yesPrice': result = (marketA?.yesPrice ?? 0) - (marketB?.yesPrice ?? 0); break;
        case 'spread': result = (quoteA?.spread ?? 0) - (quoteB?.spread ?? 0); break;
        case 'score': result = a.score - b.score; break;
        case 'confidence': result = a.confidence - b.confidence; break;
        case 'time': result = timeToHours(a.timeToExpiry) - timeToHours(b.timeToExpiry); break;
        case 'volume': result = (marketA?.volume24h ?? 0) - (marketB?.volume24h ?? 0); break;
        case 'rr': result = a.riskReward - b.riskReward; break;
        default: result = 0;
      }
      return sortDirection === 'asc' ? result : -result;
    });
    return copy;
  }, [actionableSignals, markets, quotes, sortDirection, sortKey]);

  const yesSignals = useMemo(() => actionableSignals.filter(s => s.direction === 'YES').length, [actionableSignals]);
  const noSignals = useMemo(() => actionableSignals.filter(s => s.direction === 'NO').length, [actionableSignals]);
  const avgEdge = useMemo(() => {
    const active = actionableSignals.filter(s => s.action !== 'wait');
    return active.reduce((sum, sig) => sum + sig.expectedNetEdge, 0) / Math.max(1, active.length);
  }, [actionableSignals]);

  if (!data && !isLoading && !isFetching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Zap className="w-8 h-8 text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Click below to scan live markets on demand</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold text-sm hover:opacity-90 transition">
            Scan Now
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Activity className="w-6 h-6 text-primary animate-pulse mx-auto" />
          <p className="text-sm text-muted-foreground">Scanning live markets…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto bg-card border border-loss/40 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-loss font-semibold"><WifiOff className="w-4 h-4" /> Live data unavailable</div>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Market feed request failed.'}</p>
        </div>
      </div>
    );
  }

  const freshness = getFreshnessStatus(data?.fetchedAt);
  const remaining = scannerConfig.profile.dailyTarget;
  const tradesNeeded = Math.ceil(remaining / Math.max(0.0001, avgEdge * 30));

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((c) => (c === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'market' || key === 'platform' || key === 'time' ? 'asc' : 'desc');
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <button type="button" onClick={() => setSort(k)} className={`hover:text-foreground ${sortKey === k ? 'text-foreground font-semibold' : ''}`}>
      {label}{sortKey === k ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> Live Scanner
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} disabled={isFetching} className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-bold hover:opacity-90 transition disabled:opacity-50">
            {isFetching ? 'Scanning…' : '⚡ Scan Now'}
          </button>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${freshnessColors[freshness]}`}>{freshness}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(data!.fetchedAt).toLocaleTimeString()} · {data?.source === 'demo' ? 'Demo' : data?.source === 'integrations-api' ? 'Live API' : 'Feed'}
          </span>
        </div>
      </div>

      {/* Source warnings */}
      {data?.source === 'demo' && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Demo mode — live exchange APIs returned no active markets. Configure integrations or <code className="bg-warning/20 px-1 rounded">VITE_MARKET_DATA_URL</code> for real-time data.</span>
        </div>
      )}

      {data?.droppedCount ? (
        <div className="text-[10px] text-muted-foreground">
          {data.droppedCount} stale/closed/invalid markets filtered out · {markets.length} active markets shown
        </div>
      ) : null}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Active Markets', value: markets.length.toString(), icon: Activity, color: 'text-foreground' },
          { label: 'YES Signals', value: yesSignals.toString(), icon: TrendingUp, color: 'text-profit' },
          { label: 'NO Signals', value: noSignals.toString(), icon: TrendingDown, color: 'text-loss' },
          { label: 'Avg Edge', value: fmtC(avgEdge), icon: DollarSign, color: 'text-profit' },
          { label: 'Daily Target', value: fmt(remaining), icon: Target, color: 'text-primary' },
          { label: 'Max Loss', value: fmt(scannerConfig.profile.maxDailyLoss), icon: AlertTriangle, color: 'text-loss' },
          { label: 'Est. Trades', value: Number.isFinite(tradesNeeded) ? tradesNeeded.toString() : '—', icon: Clock, color: 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card border border-border rounded-lg p-3 interactive-lift">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
            <span className={`text-lg font-bold font-mono ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-thin pb-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Filter className="w-3.5 h-3.5" />
          <span>Direction:</span>
        </div>
        {(['ALL', 'YES', 'NO'] as FilterDirection[]).map(d => (
          <button key={d} onClick={() => setFilterDirection(d)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${filterDirection === d
              ? d === 'YES' ? 'bg-profit/20 text-profit' : d === 'NO' ? 'bg-loss/20 text-loss' : 'bg-primary/20 text-primary'
              : 'bg-surface-2 text-muted-foreground hover:text-foreground'
            }`}>{d}</button>
        ))}
        <span className="text-muted-foreground shrink-0">|</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">Category:</div>
        {(['all', 'sports', 'politics', 'economics', 'crypto', 'tech', 'finance', 'weather', 'entertainment', 'science', 'health', 'legal', 'other'] as FilterCategory[]).map(c => (
          <button key={c} onClick={() => setFilterCategory(c)}
            className={`px-2 py-1 rounded text-[10px] capitalize transition-colors shrink-0 ${filterCategory === c ? 'bg-primary/20 text-primary font-bold' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}>{c}</button>
        ))}
      </div>

      {/* Main signals table */}
      <div className="glass-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Signals ({sortedSignals.length})</h2>
          <span className="text-[10px] text-muted-foreground">Click headers to sort · Click market to drill down</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="direction" label="Signal" /></th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="market" label="Market" /></th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="platform" label="Src" /></th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="yesPrice" label="YES/NO" /></th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="spread" label="Spread" /></th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="score" label="Score" /></th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="confidence" label="Conf" /></th>
                <th className="px-3 py-2 text-left font-medium">Entry → Target</th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="rr" label="R:R" /></th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="volume" label="Vol 24h" /></th>
                <th className="px-3 py-2 text-left font-medium"><SortHeader k="time" label="Exp" /></th>
                <th className="px-3 py-2 text-left font-medium">Trade</th>
              </tr>
            </thead>
            <tbody>
              {sortedSignals.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">No signals match current filters.</td></tr>
              )}
              {sortedSignals.map(sig => {
                const mkt = markets.find(m => m.id === sig.marketId);
                const qt = quotes.find(q => q.marketId === sig.marketId);
                if (!mkt || !qt) return null;

                return (
                  <tr key={sig.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors group">
                    <td className="px-3 py-2">
                      <div className={`flex items-center gap-1 font-bold ${directionColor(sig.direction)}`}>
                        {directionIcon(sig.direction)}
                        <span>{sig.direction}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/market/${sig.marketId}`} className="text-accent hover:underline font-medium block truncate max-w-[200px]" title={mkt.title}>
                        {mkt.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 bg-surface-2 rounded uppercase text-[10px]">{mkt.platform === 'kalshi' ? 'KAL' : 'PM'}</span>
                    </td>
                    <td className="px-3 py-2 font-mono">
                      <span className="text-profit">{fmtPct(mkt.impliedProbYes)}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-loss">{fmtPct(mkt.impliedProbNo)}</span>
                    </td>
                    <td className="px-3 py-2 font-mono">{fmtC(qt.spread)}</td>
                    <td className="px-3 py-2">
                      <span className={`font-bold ${sig.score >= 70 ? 'text-profit' : sig.score >= 50 ? 'text-warning' : 'text-muted-foreground'}`}>{sig.score}</span>
                    </td>
                    <td className="px-3 py-2">{sig.confidence}%</td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {sig.direction !== 'PASS' ? (
                        <span>
                          {(sig.entryZone[0] * 100).toFixed(0)}¢→{(sig.targetPrice * 100).toFixed(0)}¢
                          <span className="text-loss ml-1">✕{(sig.invalidationPrice * 100).toFixed(0)}¢</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {sig.riskReward > 0 ? <span className={sig.riskReward >= 1.5 ? 'text-profit' : 'text-muted-foreground'}>{sig.riskReward.toFixed(1)}</span> : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      ${mkt.volume24h >= 1000 ? `${(mkt.volume24h / 1000).toFixed(0)}k` : mkt.volume24h}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{sig.timeToExpiry}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <a href={buildOutcomeTradeUrl(mkt, 'yes')} target="_blank" rel="noreferrer"
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-profit/15 text-profit hover:bg-profit/25">YES</a>
                        <a href={buildOutcomeTradeUrl(mkt, 'no')} target="_blank" rel="noreferrer"
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-loss/15 text-loss hover:bg-loss/25">NO</a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profit Calculator */}
      {sortedSignals.length > 0 && (() => {
        const stakes = [1, 5, 10];
        const takerFee = scannerConfig.profile.feeModel.taker;
        const slippage = scannerConfig.profile.slippageModel;
        const topPlays = sortedSignals.filter(s => s.direction !== 'PASS').slice(0, 10);

        const calcProfit = (entryPrice: number, stake: number) => {
          const contracts = Math.floor(stake / entryPrice);
          if (contracts <= 0) return { contracts: 0, gross: 0, fees: 0, slip: 0, net: 0, roi: 0 };
          const gross = (1 - entryPrice) * contracts;
          const fees = takerFee * contracts * 2; // entry + exit
          const slip = slippage * contracts * 2;
          const net = gross - fees - slip;
          const cost = entryPrice * contracts;
          const roi = cost > 0 ? (net / cost) * 100 : 0;
          return { contracts, gross, fees, slip, net, roi };
        };

        // Totals if you win ALL plays
        const totals = stakes.map(stake => {
          let totalNet = 0, totalFees = 0, totalSlip = 0, totalGross = 0, totalCost = 0;
          topPlays.forEach(sig => {
            const entry = sig.entryZone[0];
            const r = calcProfit(entry, stake);
            totalNet += r.net;
            totalFees += r.fees;
            totalSlip += r.slip;
            totalGross += r.gross;
            totalCost += entry * r.contracts;
          });
          return { stake, totalNet, totalFees, totalSlip, totalGross, totalCost, roi: totalCost > 0 ? (totalNet / totalCost) * 100 : 0 };
        });

        return (
          <div className="glass-card border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-profit" /> Profit Calculator
                <span className="text-[10px] text-muted-foreground font-normal">
                  If you catch & win ALL {topPlays.length} plays · Fee: {(takerFee * 100).toFixed(1)}¢/contract · Slippage: {(slippage * 100).toFixed(1)}¢/contract
                </span>
              </h2>
            </div>

            {/* Summary totals */}
            <div className="grid grid-cols-3 gap-3 p-4 border-b border-border">
              {totals.map(t => (
                <div key={t.stake} className="bg-surface-2 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">@ ${t.stake}/trade</div>
                  <div className={`text-xl font-bold font-mono ${t.totalNet >= 0 ? 'text-profit' : 'text-loss'}`}>
                    ${t.totalNet.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    ROI: <span className={t.roi >= 0 ? 'text-profit' : 'text-loss'}>{t.roi.toFixed(1)}%</span>
                    {' · '}Fees: <span className="text-loss">${t.totalFees.toFixed(2)}</span>
                    {' · '}Slip: <span className="text-loss">${t.totalSlip.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Per-trade breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Signal</th>
                    <th className="px-3 py-2 text-left font-medium">Market</th>
                    <th className="px-3 py-2 text-left font-medium">Entry</th>
                    {stakes.map(s => (
                      <th key={s} className="px-3 py-2 text-center font-medium" colSpan={1}>${s} Net</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topPlays.map(sig => {
                    const mkt = markets.find(m => m.id === sig.marketId);
                    if (!mkt) return null;
                    const entry = sig.entryZone[0];
                    return (
                      <tr key={sig.id} className="border-b border-border/50 hover:bg-surface-2 cursor-pointer" onClick={() => navigate(`/market/${mkt.id}`)}>
                        <td className="px-3 py-2">
                          <span className={`font-bold ${directionColor(sig.direction)}`}>{sig.direction}</span>
                        </td>
                        <td className="px-3 py-2 truncate max-w-[180px]" title={mkt.title}>{mkt.title}</td>
                        <td className="px-3 py-2 font-mono">{(entry * 100).toFixed(0)}¢</td>
                        {stakes.map(s => {
                          const r = calcProfit(entry, s);
                          return (
                            <td key={s} className="px-3 py-2 text-center font-mono">
                              <span className={r.net >= 0 ? 'text-profit' : 'text-loss'}>
                                {r.net >= 0 ? '+' : ''}${r.net.toFixed(2)}
                              </span>
                              <div className="text-[9px] text-muted-foreground">{r.contracts}ct · {r.roi.toFixed(0)}%</div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Top thesis cards */}
      {sortedSignals.filter(s => s.direction !== 'PASS').length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Top Setups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sortedSignals.filter(s => s.direction !== 'PASS').slice(0, 6).map(sig => {
              const mkt = markets.find(m => m.id === sig.marketId)!;
              return (
                <Link key={sig.id} to={`/market/${sig.marketId}`} className="glass-card border border-border rounded-lg p-3 space-y-2 interactive-lift block">
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-1.5 font-bold text-sm ${directionColor(sig.direction)}`}>
                      {directionIcon(sig.direction)} {sig.direction}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{sig.setupType}</span>
                  </div>
                  <p className="text-xs font-medium truncate">{mkt.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{sig.thesis}</p>
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span>Score: <strong>{sig.score}</strong></span>
                    <span>Conf: <strong>{sig.confidence}%</strong></span>
                    <span>R:R: <strong>{sig.riskReward.toFixed(1)}</strong></span>
                    <span className="text-muted-foreground">{sig.timeToExpiry}</span>
                  </div>
                  <div className="text-[10px] font-mono">
                    Entry: {(sig.entryZone[0] * 100).toFixed(0)}-{(sig.entryZone[1] * 100).toFixed(0)}¢ →
                    <span className="text-profit ml-1">T:{(sig.targetPrice * 100).toFixed(0)}¢</span>
                    <span className="text-loss ml-1">✕{(sig.invalidationPrice * 100).toFixed(0)}¢</span>
                  </div>
                  {sig.smartMoneyFlag && (
                    <span className="inline-block px-1.5 py-0.5 bg-primary/20 text-primary rounded text-[9px] font-bold">🐋 Smart Money Activity</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
