import { BookOpen, Plus, TrendingUp, TrendingDown, MinusCircle } from 'lucide-react';
import { useState } from 'react';
import { DEMO_JOURNAL_TRADES } from '@/data/demoData';
import { JournalTrade } from '@/data/types';

const STORAGE_KEY = 'kso_journal';

const loadJournal = (): JournalTrade[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    return [...saved, ...DEMO_JOURNAL_TRADES];
  } catch {
    return DEMO_JOURNAL_TRADES;
  }
};

const saveJournal = (trades: JournalTrade[]) => {
  // Only save user-created trades, not demo
  const userTrades = trades.filter(t => !t.id.startsWith('jt-'));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userTrades));
};

const Journal = () => {
  const [trades, setTrades] = useState<JournalTrade[]>(loadJournal);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    marketTitle: '', side: 'YES' as 'YES' | 'NO', setupType: '', entryPrice: 0.50,
    exitPrice: '', stopPrice: 0.40, size: 25, notes: '', status: 'open' as 'open' | 'closed' | 'stopped',
  });

  const totalPnl = trades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const winCount = trades.filter(t => t.status === 'closed' && (t.realizedPnl ?? 0) > 0).length;
  const lossCount = trades.filter(t => t.status === 'closed' && (t.realizedPnl ?? 0) < 0).length;
  const stopCount = trades.filter(t => t.status === 'stopped').length;
  const openCount = trades.filter(t => t.status === 'open').length;
  const winRate = winCount + lossCount > 0 ? (winCount / (winCount + lossCount) * 100).toFixed(1) : '—';

  const addTrade = () => {
    const exit = form.exitPrice ? Number(form.exitPrice) : null;
    const pnl = exit != null ? (exit - form.entryPrice) * form.size - form.size * 0.04 : null;
    const newTrade: JournalTrade = {
      id: `ut-${Date.now()}`,
      marketId: '',
      marketTitle: form.marketTitle,
      setupType: form.setupType,
      entryPrice: form.entryPrice,
      exitPrice: exit,
      stopPrice: form.stopPrice,
      size: form.size,
      fees: form.size * 0.03,
      slippage: form.size * 0.01,
      realizedPnl: pnl,
      notes: form.notes,
      mode: 'paper',
      timestamp: new Date().toISOString(),
      status: form.status,
      category: 'economics',
      side: form.side,
      confidenceAtEntry: 0,
      signalScoreAtEntry: 0,
    };
    const updated = [newTrade, ...trades];
    setTrades(updated);
    saveJournal(updated);
    setShowForm(false);
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" /> Trade Journal
        </h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" /> Log Trade
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total P&L', value: `$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? 'text-profit' : 'text-loss' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'text-foreground' },
          { label: 'Wins', value: winCount.toString(), color: 'text-profit' },
          { label: 'Losses', value: lossCount.toString(), color: 'text-loss' },
          { label: 'Stopped', value: stopCount.toString(), color: 'text-warning' },
          { label: 'Open', value: openCount.toString(), color: 'text-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card border border-border rounded-lg p-3">
            <span className="text-[10px] text-muted-foreground block">{label}</span>
            <span className={`text-lg font-bold font-mono ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* New trade form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">Log New Trade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <label>Market <input value={form.marketTitle} onChange={e => setForm(f => ({ ...f, marketTitle: e.target.value }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5" placeholder="Market title" /></label>
            <label>Setup <input value={form.setupType} onChange={e => setForm(f => ({ ...f, setupType: e.target.value }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5" placeholder="e.g. Momentum Entry" /></label>
            <label>Side
              <select value={form.side} onChange={e => setForm(f => ({ ...f, side: e.target.value as 'YES' | 'NO' }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5">
                <option value="YES">YES</option><option value="NO">NO</option>
              </select>
            </label>
            <label>Entry <input type="number" step="0.01" value={form.entryPrice} onChange={e => setForm(f => ({ ...f, entryPrice: +e.target.value }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5 font-mono" /></label>
            <label>Exit (blank if open) <input type="number" step="0.01" value={form.exitPrice} onChange={e => setForm(f => ({ ...f, exitPrice: e.target.value }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5 font-mono" /></label>
            <label>Stop <input type="number" step="0.01" value={form.stopPrice} onChange={e => setForm(f => ({ ...f, stopPrice: +e.target.value }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5 font-mono" /></label>
            <label>Size <input type="number" value={form.size} onChange={e => setForm(f => ({ ...f, size: +e.target.value }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5 font-mono" /></label>
            <label>Status
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'open' | 'closed' | 'stopped' }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5">
                <option value="open">Open</option><option value="closed">Closed</option><option value="stopped">Stopped</option>
              </select>
            </label>
          </div>
          <label className="text-xs">Notes <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5" rows={2} /></label>
          <button onClick={addTrade} className="px-4 py-2 bg-primary text-primary-foreground rounded text-xs font-semibold">Save Trade</button>
        </div>
      )}

      {/* Trade log table */}
      <div className="glass-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Trade Log ({trades.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {['Time', 'Market', 'Side', 'Setup', 'Entry', 'Exit', 'Stop', 'Size', 'P&L', 'Status', 'Conf', 'Notes'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} className="border-b border-border/40 hover:bg-surface-2">
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{new Date(t.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2 truncate max-w-[180px]">{t.marketTitle}</td>
                  <td className="px-3 py-2">
                    <span className={`flex items-center gap-1 font-bold ${t.side === 'YES' ? 'text-profit' : t.side === 'NO' ? 'text-loss' : 'text-muted-foreground'}`}>
                      {t.side === 'YES' ? <TrendingUp className="w-3 h-3" /> : t.side === 'NO' ? <TrendingDown className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                      {t.side}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.setupType}</td>
                  <td className="px-3 py-2 font-mono">{(t.entryPrice * 100).toFixed(0)}¢</td>
                  <td className="px-3 py-2 font-mono">{t.exitPrice != null ? `${(t.exitPrice * 100).toFixed(0)}¢` : '—'}</td>
                  <td className="px-3 py-2 font-mono text-loss">{(t.stopPrice * 100).toFixed(0)}¢</td>
                  <td className="px-3 py-2 font-mono">{t.size}</td>
                  <td className={`px-3 py-2 font-mono font-bold ${(t.realizedPnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {t.realizedPnl != null ? `$${t.realizedPnl.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${t.status === 'open' ? 'bg-primary/15 text-primary' : t.status === 'closed' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{t.confidenceAtEntry > 0 ? `${t.confidenceAtEntry}%` : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{t.notes}</td>
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
