import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kso.trader.watchlist";

export const useTraderWatchlist = () => {
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setEntries(parsed.filter((item) => typeof item === "string"));
      }
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const set = useMemo(() => new Set(entries), [entries]);

  return {
    entries,
    isWatched: (traderId: string) => set.has(traderId),
    toggle: (traderId: string) => {
      setEntries((current) =>
        current.includes(traderId)
          ? current.filter((value) => value !== traderId)
          : [...current, traderId]
      );
    },
  };
};
