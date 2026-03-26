import { useQuery } from '@tanstack/react-query';
import { scannerConfig } from '@/data/liveApi';
import { integrationsApi } from './api';

export function useIntegratedFeeModel() {
  return useQuery({
    queryKey: ['integrations', 'fee-model'],
    queryFn: async () => {
      const providers = await integrationsApi.list();
      const withFee = providers.providers.find((row) => row.integration?.provider === 'polymarket')
        ?? providers.providers.find((row) => row.integration?.provider === 'kalshi');

      return {
        maker: scannerConfig.profile.feeModel.maker,
        taker: scannerConfig.profile.feeModel.taker,
        slippage: scannerConfig.profile.slippageModel,
        source: withFee?.provider ?? 'default',
        syncedAt: withFee?.integration?.lastSuccessfulSyncAt ?? null,
      };
    },
    staleTime: 30_000,
  });
}
