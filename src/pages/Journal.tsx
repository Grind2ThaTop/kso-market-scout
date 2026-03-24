import { journalTrades, tradingProfile } from '@/data/demoData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { BookOpen } from 'lucide-react';

const Journal = () => {
  const closed = journalTrades.filter(t => t.status !== 'open');
  const totalPnl = closed.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const winners = closed.filter(t => (t.realizedPnl ?? 0) > 0);
  const losers = closed.filter(t => (t.realizedPnl ?? 0) < 0);
  const winRate = closed.length > 0 ? winners.length / closed.length : 0;
  const avgWinner = winners.length > 0 ? winners.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / winners.length : 0;
  const avgLoser = losers.length > 0 ? losers.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / losers.length : 0;
  const totalFees = closed.reduce((s, t) => s + t.fees, 0);
  const totalSlippage = closed.reduce((s, t) => s + t.slippage, 0);

  // Equity curve
  let running = 0;
  const equityCurve = closed.map(t => {
    running += t.realizedPnl ?? 0;
    return { trade: t.id, equity: running };
  });

  // P&L by setup
  const bySetup: Record<string, number> = {};
  closed.forEach(t => { bySetup[t.setupType] = (bySetup[t.setupType] ?? 0) + (t.realizedPnl ?? 0); });
  const setupData = Object.entries(bySetup).map(([name, pnl]) => ({ name, pnl }));

  // P&L by category
  const byCat: Record<string, number> = {};
  closed.forEach(t => { byCat[t.category] = (byCat[t.category] ?? 0) + (t.realizedPnl ?? 0); });
  const catData = Object.entries(byCat).map(([name, pnl]) => ({ name, pnl }));

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" /> Journal & Analytics
      </h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Total P&L', value: `$${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? 'text-profit' : 'text-loss' },
          { label: 'Win Rate', value: `${(winRate * 100).toFixed(0)}%`, color: winRate > 0.5 ? 'text-profit' : 'text-loss' },
          { label: 'Avg Winner', value: `$${avgWinner.toFixed(0)}`, color: 'text-profit' },
          { label: 'Avg Loser', value: `$${avgLoser.toFixed(0)}`, color: 'text-loss' },
          { label: 'Total Trades', value: closed.length.toString(), color: '' },
          { label: 'Fee Drag', value: `$${totalFees.toFixed(2)}`, color: 'text-warn' },
          { label: 'Slippage', value: `$${totalSlippage.toFixed(2)}`, color: 'text-warn' },
          { label: 'Open', value: journalTrades.filter(t => t.status === 'open').length.toString(), color: 'text-info' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3">
            <span className="text-[10px] text-muted-foreground block">{label}</span>
            <span className={`text-sm font-bold font-mono ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Equity Curve */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Equity Curve</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={equityCurve}>
              <XAxis dataKey="trade" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12, borderRadius: 6 }} />
              <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* P&L by Setup */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">P&L by Setup</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={setupData}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12, borderRadius: 6 }} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {setupData.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trade History */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Trade History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {['Time', 'Market', 'Setup', 'Side', 'Entry', 'Exit', 'Stop', 'Size', 'Fees', 'Slip', 'P&L', 'Notes'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {journalTrades.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-surface-2">
                  <td className="px-3 py-2 text-muted-foreground font-mono">{new Date(t.timestamp).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-accent">{t.marketTitle}</td>
                  <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px]">{t.setupType}</span></td>
                  <td className="px-3 py-2 uppercase">{t.mode}</td>
                  <td className="px-3 py-2 font-mono">{t.entryPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono">{t.exitPrice?.toFixed(2) ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{t.stopPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono">{t.size}</td>
                  <td className="px-3 py-2 font-mono text-warn">${t.fees.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-warn">${t.slippage.toFixed(2)}</td>
                  <td className={`px-3 py-2 font-mono font-bold ${(t.realizedPnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{t.realizedPnl != null ? `$${t.realizedPnl.toFixed(0)}` : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{t.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Journal;
