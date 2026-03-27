import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Star, TrendingDown, TrendingUp, ShieldAlert } from "lucide-react";
import { polymarketProvider } from "@/lib/polymarketProvider";
import { capabilityMatrix } from "@/lib/traderCapabilities";
import { useTraderWatchlist } from "@/hooks/useTraderWatchlist";

const currency = (value?: number) => (value == null ? "—" : `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
const percent = (value?: number) => (value == null ? "—" : `${value.toFixed(1)}%`);

const TraderTable = ({
  title,
  rows,
  icon: Icon,
  isWatched,
  onWatchToggle,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof polymarketProvider.getTopTraders>>;
  icon: typeof TrendingUp;
  isWatched: (id: string) => boolean;
  onWatchToggle: (id: string) => void;
}) => (
  <div className="glass-card border border-border rounded-lg overflow-hidden">
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h2>
      <span className="text-[10px] text-muted-foreground">Live source: Polymarket public API</span>
    </div>
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          {['#', 'Trader', 'PnL', 'ROI', 'Win rate', 'Markets', 'Watch'].map((label) => (
            <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((trader) => (
          <tr key={`${title}-${trader.traderId}`} className="border-b border-border/40 hover:bg-surface-2">
            <td className="px-3 py-2 font-mono">{trader.rank}</td>
            <td className="px-3 py-2">
              <Link to={`/smart-money/trader/${encodeURIComponent(trader.traderId)}`} className="text-accent hover:underline">
                {trader.username}
              </Link>
              <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">{trader.walletAddress ?? trader.traderId}</p>
            </td>
            <td className={`px-3 py-2 font-mono ${(trader.realizedPnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{currency(trader.realizedPnl)}</td>
            <td className="px-3 py-2">{percent(trader.roiPct)}</td>
            <td className="px-3 py-2">{percent(trader.winRatePct)}</td>
            <td className="px-3 py-2">{trader.totalMarketsTraded ?? '—'}</td>
            <td className="px-3 py-2">
              <button onClick={() => onWatchToggle(trader.traderId)} className="p-1 rounded hover:bg-muted" title="Toggle watchlist">
                <Star className={`w-4 h-4 ${isWatched(trader.traderId) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SmartMoneyTracker = () => {
  const watchlist = useTraderWatchlist();

  const topQuery = useQuery({
    queryKey: ["smart-money", "top-traders"],
    queryFn: () => polymarketProvider.getTopTraders(25),
  });

  const worstQuery = useQuery({
    queryKey: ["smart-money", "worst-traders"],
    queryFn: () => polymarketProvider.getWorstTraders(25),
  });

  const leaderboardErrorMessage = topQuery.error instanceof Error
    ? topQuery.error.message
    : worstQuery.error instanceof Error
      ? worstQuery.error.message
      : "Unknown error";

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="glass-card border border-border rounded-lg p-4">
        <h1 className="text-xl font-semibold">Smart Money Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Goal: identify killers, track current positioning, and surface follow/fade opportunities using hard data only.
        </p>
      </div>

      <div className="glass-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Capability Matrix (Reality Check)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {['Platform', 'Leaderboard', 'Profiles', 'Positions', 'Trade history', 'Realtime', 'Core tracking auth?', 'Notes'].map((label) => (
                <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilityMatrix.map((row) => (
              <tr key={row.platform} className="border-b border-border/40">
                <td className="px-3 py-2 capitalize font-semibold">{row.platform}</td>
                <td className="px-3 py-2">{row.leaderboardAvailability}</td>
                <td className="px-3 py-2">{row.publicTraderProfiles}</td>
                <td className="px-3 py-2">{row.publicPositions}</td>
                <td className="px-3 py-2">{row.publicTradeHistory}</td>
                <td className="px-3 py-2">{row.realTimeTrackability}</td>
                <td className="px-3 py-2">{row.requiresAuthForCoreTracking ? 'yes' : 'no'}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.blockedNotes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(topQuery.isError || worstQuery.isError) && (
        <div className="bg-loss/10 border border-loss/30 rounded-lg p-3 text-sm text-loss flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Could not load live leaderboard data from Polymarket in this runtime. The module intentionally does not fall back to mock trader data.
          <span className="text-xs opacity-80">Reason: {leaderboardErrorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TraderTable
          title="Top Traders"
          rows={topQuery.data ?? []}
          icon={TrendingUp}
          isWatched={watchlist.isWatched}
          onWatchToggle={watchlist.toggle}
        />
        <TraderTable
          title="Biggest Losers / Fade Targets"
          rows={worstQuery.data ?? []}
          icon={TrendingDown}
          isWatched={watchlist.isWatched}
          onWatchToggle={watchlist.toggle}
        />
      </div>
    </div>
  );
};

export default SmartMoneyTracker;
