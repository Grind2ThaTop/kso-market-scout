import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Target, AlertTriangle, DollarSign, Activity, WifiOff } from 'lucide-react';
import { useMarketScanner } from '@/hooks/useMarketScanner';
import { scannerConfig } from '@/data/liveApi';
import { buildOutcomeTradeUrl } from '@/lib/marketUrlBuilder';

const fmt = (n: number) => `$${n.toFixed(0)}`;
const fmtC = (n: number) => `${(n * 100).toFixed(2)}¢`;
type SortKey = 'market' | 'platform' | 'bidAsk' | 'spread' | 'score' | 'netEdge' | 'confidence' | 'time';

const timeToHours = (value: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  if (value.toLowerCase() === 'expired') return Number.NEGATIVE_INFINITY;
  if (value.toLowerCase() === 'unknown') return Number.POSITIVE_INFINITY;
  const match = value.match(/^(\d+)([hd])$/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const amount = Number(match[1]);
  return match[2].toLowerCase() === 'd' ? amount * 24 : amount;
};

const Dashboard = () => {
  const { data, isLoading, isError, error } = useMarketScanner();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading live market feed…</div>;
  }

  if (isError) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto bg-card border border-loss/40 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2 text-loss font-semibold"><WifiOff className="w-4 h-4" /> Live data unavailable</div>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Market feed request failed.'}</p>
          <p className="text-xs text-muted-foreground">Set <code>VITE_MARKET_DATA_URL</code> and optional <code>VITE_MARKET_DATA_API_KEY</code> in your environment.</p>
        </div>
      </div>
    );
  }

  const signals = data?.signals ?? [];
  const markets = data?.markets ?? [];
  const quotes = data?.quotes ?? [];

  if (markets.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">No live markets returned by the configured API.</div>;
  }

  const actionableMarkets = markets.filter((market) => market.market_url);
  const unlinkedMarkets = markets.filter((market) => !market.market_url);
  const actionableSignals = signals.filter((signal) => {
    const market = markets.find(m => m.id === signal.marketId);
    return market?.market_url;
  });

  const avgEdge = actionableSignals.filter((s) => s.action !== 'wait').reduce((sum, sig) => sum + sig.expectedNetEdge, 0) / Math.max(1, actionableSignals.filter((s) => s.action !== 'wait').length);
  const remaining = scannerConfig.profile.dailyTarget;
  const tradesNeeded = Math.ceil(remaining / Math.max(0.0001, avgEdge * 30));
  const sortedSignals = useMemo(() => {
    const copy = [...actionableSignals];
    copy.sort((a, b) => {
      const marketA = markets.find((market) => market.id === a.marketId);
      const marketB = markets.find((market) => market.id === b.marketId);
      const quoteA = quotes.find((quote) => quote.marketId === a.marketId);
      const quoteB = quotes.find((quote) => quote.marketId === b.marketId);

      let result = 0;
      switch (sortKey) {
        case 'market':
          result = (marketA?.ticker ?? '').localeCompare(marketB?.ticker ?? '');
          break;
        case 'platform':
          result = (marketA?.platform ?? '').localeCompare(marketB?.platform ?? '');
          break;
        case 'bidAsk':
          result = (quoteA?.bestYesBid ?? 0) - (quoteB?.bestYesBid ?? 0);
          break;
        case 'spread':
          result = (quoteA?.spread ?? 0) - (quoteB?.spread ?? 0);
          break;
        case 'score':
          result = a.score - b.score;
          break;
        case 'netEdge':
          result = a.expectedNetEdge - b.expectedNetEdge;
          break;
        case 'confidence':
          result = a.confidence - b.confidence;
          break;
        case 'time':
          result = timeToHours(a.timeToExpiry) - timeToHours(b.timeToExpiry);
          break;
        default:
          result = 0;
      }

      return sortDirection === 'asc' ? result : -result;
    });
    return copy;
  }, [actionableSignals, markets, quotes, sortDirection, sortKey]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'market' || key === 'platform' || key === 'time' ? 'asc' : 'desc');
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Live Scanner Dashboard</h1>
        <span className="text-xs text-muted-foreground">
          Last refresh: {new Date(data!.fetchedAt).toLocaleString()} · Source: {data?.source === 'demo' ? 'Demo fallback' : 'Live exchange feed'}
        </span>
      </div>

      {data?.source === 'demo' && (
        <div className="bg-warn/10 border border-warn/30 rounded-lg p-3 text-xs text-warn">
          Live exchange APIs are unavailable, so links and prices are simulated. Configure integrations or VITE_MARKET_DATA_URL for real-time markets.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Daily Target', value: fmt(scannerConfig.profile.dailyTarget), icon: Target, color: 'text-primary' },
          { label: 'Live Markets', value: markets.length.toString(), icon: Activity, color: 'text-foreground' },
          { label: 'Actionable Signals', value: actionableSignals.filter((s) => s.action !== 'wait').length.toString(), icon: TrendingUp, color: 'text-profit' },
          { label: 'Avg Net Edge', value: fmtC(avgEdge), icon: DollarSign, color: 'text-profit' },
          { label: 'Max Loss', value: fmt(scannerConfig.profile.maxDailyLoss), icon: AlertTriangle, color: 'text-loss' },
          { label: 'Est. Trades Needed', value: Number.isFinite(tradesNeeded) ? tradesNeeded.toString() : 'N/A', icon: Target, color: 'text-warn' },
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

      {unlinkedMarkets.length > 0 && (
        <div className="bg-warn/10 border border-warn/30 rounded-lg p-3 text-xs text-warn">
          {unlinkedMarkets.length} market(s) hidden because a live outbound URL could not be resolved.
        </div>
      )}

      <div className="glass-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Top Signals</h2>
          <span className="text-[10px] text-muted-foreground">Click headers to sort</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">
                  <button type="button" onClick={() => setSort('market')} className="hover:text-foreground">Market</button>
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <button type="button" onClick={() => setSort('platform')} className="hover:text-foreground">Platform</button>
                </th>
                <th className="px-3 py-2 text-left font-medium">Setup</th>
                <th className="px-3 py-2 text-left font-medium">
                  <button type="button" onClick={() => setSort('bidAsk')} className="hover:text-foreground">Bid/Ask</button>
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <button type="button" onClick={() => setSort('spread')} className="hover:text-foreground">Spread</button>
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <button type="button" onClick={() => setSort('score')} className="hover:text-foreground">Score</button>
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <button type="button" onClick={() => setSort('netEdge')} className="hover:text-foreground">Net Edge</button>
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <button type="button" onClick={() => setSort('confidence')} className="hover:text-foreground">Conf</button>
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <button type="button" onClick={() => setSort('time')} className="hover:text-foreground">Time</button>
                </th>
                <th className="px-3 py-2 text-left font-medium">Trade</th>
              </tr>
            </thead>
            <tbody>
              {sortedSignals.map(sig => {
                const mkt = markets.find(m => m.id === sig.marketId);
                const qt = quotes.find(q => q.marketId === sig.marketId);
                if (!mkt || !qt) return null;

                return (
                  <tr key={sig.id} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2">
                      <Link to={`/market/${sig.marketId}`} className="text-accent hover:underline font-medium">{mkt.ticker}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 bg-surface-2 rounded uppercase text-[10px]">{mkt.platform}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{sig.setupType}</td>
                    <td className="px-3 py-2 font-mono">
                      <span className="text-profit">{qt.bestYesBid.toFixed(2)}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-loss">{qt.bestYesAsk.toFixed(2)}</span>
                    </td>
                    <td className="px-3 py-2 font-mono">{fmtC(qt.spread)}</td>
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
    </div>
  );
};

export default Dashboard;
