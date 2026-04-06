import { useQuery } from '@tanstack/react-query';
import { fetchScanSnapshot, ScanSnapshot } from '@/data/liveApi';

const CACHE_KEY = 'kso-scan-cache';
const CACHE_MAX_AGE_MS = 1000 * 60 * 30; // 30 minutes

function loadCachedSnapshot(): ScanSnapshot | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const { data, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return undefined;
    }
    return data as ScanSnapshot;
  } catch {
    return undefined;
  }
}

function saveCachedSnapshot(data: ScanSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

const cachedSnapshot = loadCachedSnapshot();

export function useMarketScanner() {
  return useQuery({
    queryKey: ['live-market-scan'],
    queryFn: async () => {
      const snapshot = await fetchScanSnapshot();
      saveCachedSnapshot(snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    enabled: false,
  });
}
