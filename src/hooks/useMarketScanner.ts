import { useQuery } from '@tanstack/react-query';
import { fetchScanSnapshot, scannerConfig } from '@/data/liveApi';

export function useMarketScanner() {
  return useQuery({
    queryKey: ['live-market-scan'],
    queryFn: fetchScanSnapshot,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // keep in cache for 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    enabled: false, // on-demand only — call refetch() manually
  });
}
