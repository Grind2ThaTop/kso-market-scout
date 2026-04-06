import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Activity,
  WifiOff,
  ArrowUpRight,
  ArrowDownRight,
  MinusCircle,
  Zap,
  Clock,
  Filter,
} from 'lucide-react';
import { useMarketScanner } from '@/hooks/useMarketScanner';
import { scannerConfig } from '@/data/liveApi';
import { buildOutcomeTradeUrl } from '@/lib/marketUrlBuilder';
import { formatExpiryFilterLabel, getHoursUntil, matchesExpiryFilter } from '@/lib/marketMetadata';
import { getFreshnessStatus, freshnessColors, SignalDirection, Market } from '@/data/types';
import { trackTrade } from '@/lib/tradeTracker';
import { useToast } from '@/hooks/use-toast';

const fmt = (n: number) => `$${n.toFixed(0)}`;
const fmtC = (n: number) => `${(n * 100).toFixed(1)}¢`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

type SortKey = 'market' | 'platform' | 'direction' | 'yesPrice' | 'spread' | 'score' | 'confidence' | 'time' | 'volume' | 'rr';
type FilterDirection = 'ALL' | SignalDirection;
type FilterCategory = 'all' | 'sports' | 'politics' | 'economics' | 'weather' | 'culture' | 'crypto' | 'tech' | 'science' | 'entertainment' | 'finance' | 'health' | 'legal' | 'other';
type FilterExchange = 'all' | 'kalshi' | 'polymarket';
type FilterVolume = 'all' | '1k' | '10k' | '100k';
type FilterExpiry = 'all' | '1h' | 'today' | '24h' | '7d' | '30d';
type ViewMode = 'markets' | 'signals';

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

const getMarketHoursToExpiry = (eventEnd: string) => {
  return getHoursUntil(eventEnd);
};

const getMarketExpiryLabel = (eventEnd: string) => {
  const hours = getMarketHoursToExpiry(eventEnd);
  if (!Number.isFinite(hours)) return 'unknown';
  if (hours <= 0) return 'expired';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, isError, error, refetch } = useMarketScanner();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterDirection, setFilterDirection] = useState<FilterDirection>('ALL');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterExchange, setFilterExchange] = useState<FilterExchange>('all');
  const [filterVolume, setFilterVolume] = useState<FilterVolume>('all');
  const [filterExpiry, setFilterExpiry] = useState<FilterExpiry>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('markets');
  const { toast } = useToast();

  const signals = data?.signals ?? [];
  const markets = data?.markets ?? [];
  const quotes = data?.quotes ?? [];

  const rawFilteredMarkets = useMemo(() => {
    let filtered = [...markets];

    if (filterCategory !== 'all') {
      filtered = filtered.filter((market) => market.category === filterCategory);
    }

    if (filterExchange !== 'all') {
      filtered = filtered.filter((market) => market.platform === filterExchange);
    }

    if (filterVolume !== 'all') {
      const minVol = filterVolume === '1k' ? 1000 : filterVolume === '10k' ? 10000 : 100000;
      filtered = filtered.filter((market) => (market.volume24h ?? 0) >= minVol);
    }

    if (filterExpiry !== 'all') {
      filtered = filtered.filter((market) => matchesExpiryFilter(market.eventEnd, filterExpiry));
    }

    return filtered;
  }, [markets, filterCategory, filterExchange, filterVolume, filterExpiry]);

  const actionableSignals = useMemo(() => {
    let filtered = signals.filter((signal) => {
      if (signal.direction === 'PASS') return false;
      const market = markets.find((m) => m.id === signal.marketId);
      return market?.market_url;
    });

    if (filterDirection !== 'ALL') {
      filtered = filtered.filter((signal) => signal.direction === filterDirection);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter((signal) => {
        const market = markets.find((m) => m.id === signal.marketId);
        return market?.category === filterCategory;
      });
    }

    if (filterExchange !== 'all') {
      filtered = filtered.filter((signal) => {
        const market = markets.find((m) => m.id === signal.marketId);
        return market?.platform === filterExchange;
      });
    }

    if (filterVolume !== 'all') {
      const minVol = filterVolume === '1k' ? 1000 : filterVolume === '10k' ? 10000 : 100000;
      filtered = filtered.filter((signal) => {
        const market = markets.find((m) => m.id === signal.marketId);
        return (market?.volume24h ?? 0) >= minVol;
      });
    }

    if (filterExpiry !== 'all') {
      filtered = filtered.filter((signal) => {
        const market = markets.find((m) => m.id === signal.marketId);
        return market ? matchesExpiryFilter(market.eventEnd, filterExpiry) : false;
      });
    }

    return filtered;
  }, [signals, markets, filterDirection, filterCategory, filterExchange, filterVolume, filterExpiry]);

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
        case 'time': result = getMarketHoursToExpiry(marketA?.eventEnd ?? '') - getMarketHoursToExpiry(marketB?.eventEnd ?? ''); break;
        case 'volume': result = (marketA?.volume24h ?? 0) - (marketB?.volume24h ?? 0); break;
        case 'rr': result = a.riskReward - b.riskReward; break;
        default: result = 0;
      }
      return sortDirection === 'asc' ? result : -result;
    });
    return copy;
  }, [actionableSignals, markets, quotes, sortDirection, sortKey]);

  const sortedMarkets = useMemo(() => {
    const copy = [...rawFilteredMarkets];
    copy.sort((a, b) => {
      const quoteA = quotes.find((q) => q.marketId === a.id);
      const quoteB = quotes.find((q) => q.marketId === b.id);

      let result = 0;
      switch (sortKey) {
        case 'market': result = a.title.localeCompare(b.title); break;
        case 'platform': result = a.platform.localeCompare(b.platform); break;
        case 'yesPrice': result = (a.yesPrice ?? 0) - (b.yesPrice ?? 0); break;
        case 'spread': result = (quoteA?.spread ?? 0) - (quoteB?.spread ?? 0); break;
        case 'time': result = getMarketHoursToExpiry(a.eventEnd) - getMarketHoursToExpiry(b.eventEnd); break;
        case 'volume': result = (a.volume24h ?? 0) - (b.volume24h ?? 0); break;
        default: result = (a.volume24h ?? 0) - (b.volume24h ?? 0); break;
      }
      return sortDirection === 'asc' ? result : -result;
    });
    return copy;
  }, [rawFilteredMarkets, quotes, sortDirection, sortKey]);

  const yesSignals = useMemo(() => actionableSignals.filter((s) => s.direction === 'YES').length, [actionableSignals]);
  const noSignals = useMemo(() => actionableSignals.filter((s) => s.direction === 'NO').length, [actionableSignals]);
  const avgEdge = useMemo(() => {
    const active = actionableSignals.filter((s) => s.action !== 'wait');
    return active.reduce((sum, sig) => sum + sig.expectedNetEdge, 0) / Math.max(1, active.length);
  }, [actionableSignals]);

  const hasSignalFilters = filterDirection !== 'ALL' || filterCategory !== 'all' || filterExchange !== 'all' || filterVolume !== 'all' || filterExpiry !== 'all';
  const hasMarketFilters = filterCategory !== 'all' || filterExchange !== 'all' || filterVolume !== 'all' || filterExpiry !== 'all';

  const activeSignalFilterLabel = [
    filterExchange !== 'all' ? (filterExchange === 'kalshi' ? 'Kalshi' : 'Polymarket') : null,
    filterDirection !== 'ALL' ? filterDirection : null,
    filterVolume !== 'all' ? `vol ≥ $${filterVolume}` : null,
    filterExpiry !== 'all' ? formatExpiryFilterLabel(filterExpiry) : null,
    filterCategory !== 'all' ? filterCategory : null,
  ].filter(Boolean).join(' · ');

  const activeMarketFilterLabel = [
    filterExchange !== 'all' ? (filterExchange === 'kalshi' ? 'Kalshi' : 'Polymarket') : null,
    filterVolume !== 'all' ? `vol ≥ $${filterVolume}` : null,
    filterExpiry !== 'all' ? formatExpiryFilterLabel(filterExpiry) : null,
    filterCategory !== 'all' ? filterCategory : null,
  ].filter(Boolean).join(' · ');

  const resetFilters = () => {
    setFilterDirection('ALL');
    setFilterCategory('all');
    setFilterExchange('all');
    setFilterVolume('all');
    setFilterExpiry('all');
  };

  const handleTrackTrade = (
    market: Market,
    side: 'YES' | 'NO',
    score = 0,
    confidence = 0,
    setupType = 'Tracked from dashboard',
  ) => {
    const entryPrice = side === 'YES' ? market.yesPrice : market.noPrice;
    const stopPrice = side === 'YES' ? Math.max(0.01, entryPrice - 0.04) : Math.min(0.99, entryPrice + 0.04);

    trackTrade({
      market,
      side,
      entryPrice,
      size: 25,
      stopPrice,
      signalScoreAtEntry: score,
      confidenceAtEntry: confidence,
      setupType,
    });

    toast({
      title: `${side} trade tracked`,
      description: 'Saved to Journal as an open paper trade.',
    });
  };

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
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
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

  const renderMarketMobileCard = (market: Market) => {
    const quote = quotes.find((q) => q.marketId === market.id);
    return (
      <Link key={market.id} to={`/market/${market.id}`} className="block p-3 hover:bg-surface-2 transition-colors active:bg-surface-2">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-foreground uppercase">{market.platform === 'kalshi' ? 'KAL' : 'PM'}</span>
            <span className="px-1.5 py-0.5 bg-surface-2 rounded text-[9px] text-muted-foreground capitalize font-normal">{market.category}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">{getMarketExpiryLabel(market.eventEnd)}</div>
        </div>
        <p className="text-xs font-medium text-foreground truncate mb-1.5">{market.title}</p>
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span>
            <span className="text-profit">{fmtPct(market.impliedProbYes)}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-loss">{fmtPct(market.impliedProbNo)}</span>
            <span className="text-muted-foreground ml-1">spread {fmtC(quote?.spread ?? 0)}</span>
          </span>
          <span className="text-muted-foreground">${market.volume24h >= 1000 ? `${(market.volume24h / 1000).toFixed(0)}k` : market.volume24h}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-base md:text-lg font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> Live Scanner
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => refetch()} disabled={isFetching} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-bold hover:opacity-90 transition disabled:opacity-50">
            {isFetching ? 'Scanning…' : '⚡ Scan Now'}
          </button>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${freshnessColors[freshness]}`}>{freshness}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(data!.fetchedAt).toLocaleTimeString()} · {data?.source === 'demo' ? 'Demo' : data?.source === 'integrations-api' ? 'Live API' : 'Feed'}
          </span>
        </div>
      </div>

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

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-3">
        {[
          { label: 'Scanned', value: markets.length.toString(), icon: Activity, color: 'text-foreground' },
          { label: 'Signals', value: actionableSignals.length.toString(), icon: Zap, color: 'text-primary' },
          { label: 'YES', value: yesSignals.toString(), icon: TrendingUp, color: 'text-profit' },
          { label: 'NO', value: noSignals.toString(), icon: TrendingDown, color: 'text-loss' },
          { label: 'Avg Edge', value: fmtC(avgEdge), icon: DollarSign, color: 'text-profit' },
          { label: 'Max Loss', value: fmt(scannerConfig.profile.maxDailyLoss), icon: AlertTriangle, color: 'text-loss' },
          { label: 'Est. Trades', value: Number.isFinite(tradesNeeded) ? tradesNeeded.toString() : '—', icon: Clock, color: 'text-muted-foreground' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card border border-border rounded-lg p-2 md:p-3 interactive-lift">
            <div className="flex items-center gap-1 mb-0.5 md:mb-1">
              <Icon className={`w-3 h-3 md:w-3.5 md:h-3.5 ${color}`} />
              <span className="text-[9px] md:text-[10px] text-muted-foreground truncate">{label}</span>
            </div>
            <span className={`text-sm md:text-lg font-bold font-mono ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 overflow-x-auto scrollbar-thin pb-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Filter className="w-3.5 h-3.5" />
          <span>Exchange:</span>
        </div>
        {(['all', 'kalshi', 'polymarket'] as FilterExchange[]).map((exchange) => (
          <button
            key={exchange}
            onClick={() => setFilterExchange(exchange)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${filterExchange === exchange ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}
          >
            {exchange === 'all' ? 'ALL' : exchange === 'kalshi' ? 'KAL' : 'PM'}
          </button>
        ))}

        <span className="text-muted-foreground shrink-0">|</span>

        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <span>Direction:</span>
        </div>
        {(['ALL', 'YES', 'NO'] as FilterDirection[]).map((direction) => (
          <button
            key={direction}
            onClick={() => setFilterDirection(direction)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${filterDirection === direction
              ? direction === 'YES'
                ? 'bg-profit/20 text-profit'
                : direction === 'NO'
                  ? 'bg-loss/20 text-loss'
                  : 'bg-primary/20 text-primary'
              : 'bg-surface-2 text-muted-foreground hover:text-foreground'
            }`}
          >
            {direction}
          </button>
        ))}

        <span className="text-muted-foreground shrink-0">|</span>

        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <span>Vol:</span>
        </div>
        {(['all', '1k', '10k', '100k'] as FilterVolume[]).map((volume) => (
          <button
            key={volume}
            onClick={() => setFilterVolume(volume)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${filterVolume === volume ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}
          >
            {volume === 'all' ? 'ALL' : `≥$${volume}`}
          </button>
        ))}

        <span className="text-muted-foreground shrink-0">|</span>

        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <span>Exp:</span>
        </div>
        {(['all', '1h', 'today', '24h', '7d', '30d'] as FilterExpiry[]).map((expiry) => (
          <button
            key={expiry}
            onClick={() => setFilterExpiry(expiry)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors shrink-0 ${filterExpiry === expiry ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}
          >
            {expiry === 'all' ? 'ALL' : expiry === 'today' ? 'TODAY' : `≤${expiry}`}
          </button>
        ))}

        <span className="text-muted-foreground shrink-0">|</span>

        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">Category:</div>
        {(['all', 'sports', 'politics', 'economics', 'crypto', 'tech', 'finance', 'weather', 'culture', 'entertainment', 'science', 'health', 'legal', 'other'] as FilterCategory[]).map((category) => (
          <button
            key={category}
            onClick={() => setFilterCategory(category)}
            className={`px-2 py-1 rounded text-[10px] capitalize transition-colors shrink-0 ${filterCategory === category ? 'bg-primary/20 text-primary font-bold' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}
          >
            {category}
          </button>
        ))}
      </div>

      {viewMode === 'markets' && filterDirection !== 'ALL' && (
        <div className="text-[10px] text-muted-foreground">Direction filter only applies to the Signals view.</div>
      )}

      <div className="glass-card border border-border rounded-lg">
        <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setViewMode('markets')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${viewMode === 'markets' ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground'}`}
            >
              All Markets ({sortedMarkets.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('signals')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${viewMode === 'signals' ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground'}`}
            >
              Signals ({sortedSignals.length})
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground hidden md:inline">
            {viewMode === 'markets' ? 'Browsing all scanned markets' : 'Showing actionable setups only'}
          </span>
        </div>

        {viewMode === 'markets' ? (
          <>
            <div className="md:hidden divide-y divide-border/50">
              {sortedMarkets.length === 0 && (
                <div className="px-3 py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">No scanned markets match {activeMarketFilterLabel || 'these filters'}.</p>
                  {hasMarketFilters && (
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <button onClick={resetFilters} className="px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs font-semibold">
                        Reset filters
                      </button>
                    </div>
                  )}
                </div>
              )}
              {sortedMarkets.map(renderMarketMobileCard)}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium"><SortHeader k="market" label="Market" /></th>
                    <th className="px-3 py-2 text-left font-medium"><SortHeader k="platform" label="Src" /></th>
                    <th className="px-3 py-2 text-left font-medium">Category</th>
                    <th className="px-3 py-2 text-left font-medium"><SortHeader k="yesPrice" label="YES/NO" /></th>
                    <th className="px-3 py-2 text-left font-medium"><SortHeader k="spread" label="Spread" /></th>
                    <th className="px-3 py-2 text-left font-medium"><SortHeader k="volume" label="Vol 24h" /></th>
                    <th className="px-3 py-2 text-left font-medium"><SortHeader k="time" label="Exp" /></th>
                    <th className="px-3 py-2 text-left font-medium">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMarkets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center">
                        <div className="space-y-3">
                          <p className="text-muted-foreground">No scanned markets match {activeMarketFilterLabel || 'these filters'}.</p>
                          {hasMarketFilters && (
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              <button onClick={resetFilters} className="px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs font-semibold">
                                Reset filters
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {sortedMarkets.map((market) => {
                    const quote = quotes.find((q) => q.marketId === market.id);
                    return (
                      <tr key={market.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors group">
                        <td className="px-3 py-2">
                          <Link to={`/market/${market.id}`} className="text-accent hover:underline font-medium block truncate max-w-[260px]" title={market.title}>
                            {market.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 bg-surface-2 rounded uppercase text-[10px]">{market.platform === 'kalshi' ? 'KAL' : 'PM'}</span>
                        </td>
                        <td className="px-3 py-2 capitalize text-muted-foreground">{market.category}</td>
                        <td className="px-3 py-2 font-mono">
                          <span className="text-profit">{fmtPct(market.impliedProbYes)}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-loss">{fmtPct(market.impliedProbNo)}</span>
                        </td>
                        <td className="px-3 py-2 font-mono">{fmtC(quote?.spread ?? 0)}</td>
                        <td className="px-3 py-2 font-mono text-[10px]">${market.volume24h >= 1000 ? `${(market.volume24h / 1000).toFixed(0)}k` : market.volume24h}</td>
                        <td className="px-3 py-2 text-muted-foreground">{getMarketExpiryLabel(market.eventEnd)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <a href={buildOutcomeTradeUrl(market, 'yes')} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded text-[10px] font-bold bg-profit/15 text-profit hover:bg-profit/25">YES</a>
                            <a href={buildOutcomeTradeUrl(market, 'no')} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded text-[10px] font-bold bg-loss/15 text-loss hover:bg-loss/25">NO</a>
                            <button onClick={() => handleTrackTrade(market, 'YES')} className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary hover:bg-primary/25">Track</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="md:hidden divide-y divide-border/50">
              {sortedSignals.length === 0 && (
                <div className="px-3 py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {rawFilteredMarkets.length === 0
                      ? `No scanned markets match ${activeSignalFilterLabel || 'these filters'}.`
                      : `${rawFilteredMarkets.length} scanned markets match ${activeSignalFilterLabel || 'these filters'}, but none qualify as actionable signals.`}
                  </p>
                  {hasSignalFilters && (
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <button onClick={resetFilters} className="px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs font-semibold">
                        Reset filters
                      </button>
                      {filterExchange === 'kalshi' && (filterExpiry === 'today' || filterExpiry === '24h') && (
                        <button onClick={() => setFilterExpiry('7d')} className="px-3 py-1.5 rounded-md bg-surface-2 text-foreground text-xs font-semibold">
                          Try ≤7D
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {sortedSignals.map((sig) => {
                const market = markets.find((m) => m.id === sig.marketId);
                const quote = quotes.find((q) => q.marketId === sig.marketId);
                if (!market || !quote) return null;

                return (
                  <Link key={sig.id} to={`/market/${sig.marketId}`} className="block p-3 hover:bg-surface-2 transition-colors active:bg-surface-2">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className={`flex items-center gap-1 font-bold text-xs ${directionColor(sig.direction)}`}>
                        {directionIcon(sig.direction)}
                        <span>{sig.direction}</span>
                        <span className="ml-1 px-1.5 py-0.5 bg-surface-2 rounded text-[9px] text-muted-foreground font-normal uppercase">{market.platform === 'kalshi' ? 'KAL' : 'PM'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className={`font-bold ${sig.score >= 70 ? 'text-profit' : sig.score >= 50 ? 'text-warning' : 'text-muted-foreground'}`}>{sig.score}pt</span>
                        <span className="text-muted-foreground">{sig.confidence}%</span>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-foreground truncate mb-1.5">{market.title}</p>
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span>
                        <span className="text-profit">{fmtPct(market.impliedProbYes)}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-loss">{fmtPct(market.impliedProbNo)}</span>
                        <span className="text-muted-foreground ml-1">spread {fmtC(quote.spread)}</span>
                      </span>
                      <span className="text-muted-foreground">{sig.timeToExpiry}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono mt-1">
                      <span>
                        {(sig.entryZone[0] * 100).toFixed(0)}¢→{(sig.targetPrice * 100).toFixed(0)}¢
                        <span className="text-loss ml-1">✕{(sig.invalidationPrice * 100).toFixed(0)}¢</span>
                      </span>
                      <span className={sig.riskReward >= 1.5 ? 'text-profit' : 'text-muted-foreground'}>R:R {sig.riskReward.toFixed(1)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
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
                    <tr>
                      <td colSpan={12} className="px-3 py-8 text-center">
                        <div className="space-y-3">
                          <p className="text-muted-foreground">
                            {rawFilteredMarkets.length === 0
                              ? `No scanned markets match ${activeSignalFilterLabel || 'these filters'}.`
                              : `${rawFilteredMarkets.length} scanned markets match ${activeSignalFilterLabel || 'these filters'}, but none qualify as actionable signals.`}
                          </p>
                          {hasSignalFilters && (
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              <button onClick={resetFilters} className="px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs font-semibold">
                                Reset filters
                              </button>
                              {filterExchange === 'kalshi' && (filterExpiry === 'today' || filterExpiry === '24h') && (
                                <button onClick={() => setFilterExpiry('7d')} className="px-3 py-1.5 rounded-md bg-surface-2 text-foreground text-xs font-semibold">
                                  Try ≤7D
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {sortedSignals.map((sig) => {
                    const market = markets.find((m) => m.id === sig.marketId);
                    const quote = quotes.find((q) => q.marketId === sig.marketId);
                    if (!market || !quote) return null;

                    return (
                      <tr key={sig.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors group">
                        <td className="px-3 py-2">
                          <div className={`flex items-center gap-1 font-bold ${directionColor(sig.direction)}`}>
                            {directionIcon(sig.direction)}
                            <span>{sig.direction}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Link to={`/market/${sig.marketId}`} className="text-accent hover:underline font-medium block truncate max-w-[200px]" title={market.title}>
                            {market.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 bg-surface-2 rounded uppercase text-[10px]">{market.platform === 'kalshi' ? 'KAL' : 'PM'}</span>
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <span className="text-profit">{fmtPct(market.impliedProbYes)}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-loss">{fmtPct(market.impliedProbNo)}</span>
                        </td>
                        <td className="px-3 py-2 font-mono">{fmtC(quote.spread)}</td>
                        <td className="px-3 py-2">
                          <span className={`font-bold ${sig.score >= 70 ? 'text-profit' : sig.score >= 50 ? 'text-warning' : 'text-muted-foreground'}`}>{sig.score}</span>
                        </td>
                        <td className="px-3 py-2">{sig.confidence}%</td>
                        <td className="px-3 py-2 font-mono text-[10px]">
                          <span>
                            {(sig.entryZone[0] * 100).toFixed(0)}¢→{(sig.targetPrice * 100).toFixed(0)}¢
                            <span className="text-loss ml-1">✕{(sig.invalidationPrice * 100).toFixed(0)}¢</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {sig.riskReward > 0 ? <span className={sig.riskReward >= 1.5 ? 'text-profit' : 'text-muted-foreground'}>{sig.riskReward.toFixed(1)}</span> : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px]">${market.volume24h >= 1000 ? `${(market.volume24h / 1000).toFixed(0)}k` : market.volume24h}</td>
                        <td className="px-3 py-2 text-muted-foreground">{sig.timeToExpiry}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <a href={buildOutcomeTradeUrl(market, 'yes')} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded text-[10px] font-bold bg-profit/15 text-profit hover:bg-profit/25">YES</a>
                            <a href={buildOutcomeTradeUrl(market, 'no')} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded text-[10px] font-bold bg-loss/15 text-loss hover:bg-loss/25">NO</a>
                            <button onClick={() => handleTrackTrade(market, sig.direction === 'NO' ? 'NO' : 'YES', sig.score, sig.confidence, sig.setupType)} className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary hover:bg-primary/25">Track</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {viewMode === 'signals' && sortedSignals.length > 0 && (() => {
        const stakes = [1, 5, 10];
        const takerFee = scannerConfig.profile.feeModel.taker;
        const slippage = scannerConfig.profile.slippageModel;
        const topPlays = sortedSignals.filter((s) => s.direction !== 'PASS').slice(0, 10);

        const calcProfit = (entryPrice: number, stake: number) => {
          const contracts = Math.floor(stake / entryPrice);
          if (contracts <= 0) return { contracts: 0, gross: 0, fees: 0, slip: 0, net: 0, roi: 0 };
          const gross = (1 - entryPrice) * contracts;
          const fees = takerFee * contracts * 2;
          const slip = slippage * contracts * 2;
          const net = gross - fees - slip;
          const cost = entryPrice * contracts;
          const roi = cost > 0 ? (net / cost) * 100 : 0;
          return { contracts, gross, fees, slip, net, roi };
        };

        const totals = stakes.map((stake) => {
          let totalNet = 0;
          let totalFees = 0;
          let totalSlip = 0;
          let totalGross = 0;
          let totalCost = 0;
          topPlays.forEach((sig) => {
            const entry = sig.entryZone[0];
            const result = calcProfit(entry, stake);
            totalNet += result.net;
            totalFees += result.fees;
            totalSlip += result.slip;
            totalGross += result.gross;
            totalCost += entry * result.contracts;
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

            <div className="grid grid-cols-3 gap-2 md:gap-3 p-3 md:p-4 border-b border-border">
              {totals.map((total) => (
                <div key={total.stake} className="bg-surface-2 rounded-lg p-2 md:p-3 text-center">
                  <div className="text-[9px] md:text-[10px] text-muted-foreground mb-0.5 md:mb-1">@ ${total.stake}/trade</div>
                  <div className={`text-base md:text-xl font-bold font-mono ${total.totalNet >= 0 ? 'text-profit' : 'text-loss'}`}>
                    ${total.totalNet.toFixed(2)}
                  </div>
                  <div className="text-[8px] md:text-[10px] text-muted-foreground mt-0.5 md:mt-1">
                    ROI: <span className={total.roi >= 0 ? 'text-profit' : 'text-loss'}>{total.roi.toFixed(1)}%</span>
                    <span className="hidden sm:inline">
                      {' · '}Fees: <span className="text-loss">${total.totalFees.toFixed(2)}</span>
                      {' · '}Slip: <span className="text-loss">${total.totalSlip.toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Signal</th>
                    <th className="px-3 py-2 text-left font-medium">Market</th>
                    <th className="px-3 py-2 text-left font-medium">Entry</th>
                    {stakes.map((stake) => (
                      <th key={stake} className="px-3 py-2 text-center font-medium">${stake} Net</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topPlays.map((sig) => {
                    const market = markets.find((m) => m.id === sig.marketId);
                    if (!market) return null;
                    const entry = sig.entryZone[0];
                    return (
                      <tr key={sig.id} className="border-b border-border/50 hover:bg-surface-2 cursor-pointer" onClick={() => navigate(`/market/${market.id}`)}>
                        <td className="px-3 py-2">
                          <span className={`font-bold ${directionColor(sig.direction)}`}>{sig.direction}</span>
                        </td>
                        <td className="px-3 py-2 truncate max-w-[180px]" title={market.title}>{market.title}</td>
                        <td className="px-3 py-2 font-mono">{(entry * 100).toFixed(0)}¢</td>
                        {stakes.map((stake) => {
                          const result = calcProfit(entry, stake);
                          return (
                            <td key={stake} className="px-3 py-2 text-center font-mono">
                              <span className={result.net >= 0 ? 'text-profit' : 'text-loss'}>
                                {result.net >= 0 ? '+' : ''}${result.net.toFixed(2)}
                              </span>
                              <div className="text-[9px] text-muted-foreground">{result.contracts}ct · {result.roi.toFixed(0)}%</div>
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

      {viewMode === 'signals' && sortedSignals.filter((s) => s.direction !== 'PASS').length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Top Setups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sortedSignals.filter((s) => s.direction !== 'PASS').slice(0, 6).map((sig) => {
              const market = markets.find((m) => m.id === sig.marketId)!;
              return (
                <Link key={sig.id} to={`/market/${sig.marketId}`} className="glass-card border border-border rounded-lg p-3 space-y-2 interactive-lift block">
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-1.5 font-bold text-sm ${directionColor(sig.direction)}`}>
                      {directionIcon(sig.direction)} {sig.direction}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{sig.setupType}</span>
                  </div>
                  <p className="text-xs font-medium truncate">{market.title}</p>
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
