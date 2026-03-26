import { useQuery } from '@tanstack/react-query';
import { scannerConfig } from '@/data/liveApi';
import { integrationsApi } from './api';

export function useIntegratedFeeModel() {
  return useQuery({
    queryKey: ['integrations', 'fee-model'],
    queryFn: async () => {
      const [polyFee, kalshiFee] = await Promise.all([
        integrationsApi.fees('polymarket').catch(() => null),
        integrationsApi.fees('kalshi').catch(() => null),
      ]);

      const preferred = polyFee ?? kalshiFee;

      return {
        maker: preferred?.maker_fee ?? scannerConfig.profile.feeModel.maker,
        taker: preferred?.taker_fee ?? scannerConfig.profile.feeModel.taker,
        slippage: scannerConfig.profile.slippageModel,
        source: preferred?.provider ?? 'default',
        syncedAt: preferred?.synced_at ?? null,
      };
    },
    staleTime: 30_000,
  });
}
