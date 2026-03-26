import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { polymarketProvider } from "@/lib/polymarketProvider";

const currency = (value?: number) => (value == null ? "—" : `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
const percent = (value?: number) => (value == null ? "—" : `${value.toFixed(1)}%`);

const TraderProfilePage = () => {
  const { traderId = "" } = useParams();

  const profileQuery = useQuery({
    queryKey: ["smart-money", "trader", traderId],
    queryFn: () => polymarketProvider.getTraderProfile(decodeURIComponent(traderId)),
    enabled: Boolean(traderId),
  });

  if (profileQuery.isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading trader profile…</div>;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="p-4">
        <p className="text-sm text-loss">Unable to fetch trader profile from public endpoints. No synthetic data was inserted.</p>
      </div>
    );
  }

  const trader = profileQuery.data;

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="glass-card border border-border rounded-lg p-4">
        <Link to="/smart-money" className="text-xs text-accent hover:underline">← Back to Smart Money Tracker</Link>
        <h1 className="text-xl font-semibold mt-2">{trader.username}</h1>
        <p className="text-xs text-muted-foreground font-mono">{trader.walletAddress}</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-xs">
          <div><p className="text-muted-foreground">Realized PnL</p><p className="font-mono font-bold">{currency(trader.realizedPnl)}</p></div>
          <div><p className="text-muted-foreground">Unrealized</p><p className="font-mono font-bold">{currency(trader.unrealizedPnl)}</p></div>
          <div><p className="text-muted-foreground">ROI</p><p className="font-mono font-bold">{percent(trader.roiPct)}</p></div>
          <div><p className="text-muted-foreground">Win Rate</p><p className="font-mono font-bold">{percent(trader.winRatePct)}</p></div>
          <div><p className="text-muted-foreground">Markets Traded</p><p className="font-mono font-bold">{trader.totalMarketsTraded ?? '—'}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold">Open Positions</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {['Market', 'Side', 'Size', 'Entry', 'Current', 'Unrealized'].map((label) => (
                  <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trader.openPositions.map((position) => (
                <tr key={`${position.marketId}-${position.outcome}`} className="border-b border-border/40">
                  <td className="px-3 py-2">
                    {position.marketUrl ? <a href={position.marketUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{position.marketTitle}</a> : position.marketTitle}
                  </td>
                  <td className="px-3 py-2">{position.side}</td>
                  <td className="px-3 py-2 font-mono">{position.size.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono">{position.entryPrice?.toFixed(3) ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{position.currentPrice?.toFixed(3) ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{currency(position.unrealizedPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold">Recent Activity</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {['Time', 'Action', 'Market', 'Side', 'Price', 'Size'].map((label) => (
                  <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trader.recentActivity.map((item) => (
                <tr key={item.id} className="border-b border-border/40">
                  <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{item.action}</td>
                  <td className="px-3 py-2">{item.marketUrl ? <a href={item.marketUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{item.marketTitle ?? 'Market'}</a> : (item.marketTitle ?? '—')}</td>
                  <td className="px-3 py-2">{item.side ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{item.price?.toFixed(3) ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{item.size?.toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TraderProfilePage;
