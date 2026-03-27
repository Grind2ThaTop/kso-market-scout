import { useQuery } from '@tanstack/react-query';
import { fetchScanSnapshot, scannerConfig } from '@/data/liveApi';

export function useMarketScanner() {
  return useQuery({
    queryKey: ['live-market-scan'],
    queryFn: fetchScanSnapshot,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    enabled: false, // on-demand only — call refetch() manually
  });
}
