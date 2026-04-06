import { JournalTrade, Market } from '@/data/types';

const JOURNAL_STORAGE_KEY = 'kso_journal';

export interface TrackTradeInput {
  market: Market;
  side: 'YES' | 'NO';
  entryPrice: number;
  size: number;
  stopPrice: number;
  setupType?: string;
  confidenceAtEntry?: number;
  signalScoreAtEntry?: number;
  notes?: string;
}

const readUserJournal = (): JournalTrade[] => {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const trackTrade = ({
  market,
  side,
  entryPrice,
  size,
  stopPrice,
  setupType,
  confidenceAtEntry = 0,
  signalScoreAtEntry = 0,
  notes,
}: TrackTradeInput): JournalTrade => {
  const now = new Date().toISOString();
  const safeSize = Math.max(1, Number.isFinite(size) ? size : 1);
  const trade: JournalTrade = {
    id: `ut-${Date.now()}`,
    marketId: market.id,
    marketTitle: market.title,
    setupType: setupType ?? 'Tracked from market page',
    entryPrice,
    exitPrice: null,
    stopPrice,
    size: safeSize,
    fees: safeSize * 0.03,
    slippage: safeSize * 0.01,
    realizedPnl: null,
    notes: notes ?? `Tracked from ${market.platform} market page`,
    mode: 'paper',
    timestamp: now,
    status: 'open',
    category: market.category,
    side,
    confidenceAtEntry,
    signalScoreAtEntry,
  };

  const existing = readUserJournal();
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([trade, ...existing]));

  return trade;
};
