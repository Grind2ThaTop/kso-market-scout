import { useQuery } from '@tanstack/react-query';
import { fetchScanSnapshot, scannerConfig } from '@/data/liveApi';

export function useMarketScanner() {
  return useQuery({
    queryKey: ['live-market-scan'],
    queryFn: fetchScanSnapshot,
    refetchInterval: scannerConfig.pollIntervalMs,
    staleTime: 5_000,
    retry: 1,
  });
}
