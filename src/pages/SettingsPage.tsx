import { useState } from 'react';
import { Settings as SettingsIcon, Plug, DollarSign, Shield, Bell } from 'lucide-react';
import { scannerConfig } from '@/data/liveApi';

const SettingsPage = () => {
  const [dailyTarget, setDailyTarget] = useState(scannerConfig.profile.dailyTarget);
  const [maxLoss, setMaxLoss] = useState(scannerConfig.profile.maxDailyLoss);
  const [perTradeRisk, setPerTradeRisk] = useState(scannerConfig.profile.perTradeRisk);
  const [makerFee, setMakerFee] = useState(scannerConfig.profile.feeModel.maker * 100);
  const [takerFee, setTakerFee] = useState(scannerConfig.profile.feeModel.taker * 100);
  const [slippage, setSlippage] = useState(scannerConfig.profile.slippageModel * 100);

  const connectors = [
    { name: 'Live Market Feed', status: scannerConfig.apiUrl ? 'configured' : 'missing', lastSync: scannerConfig.apiUrl ? 'polling' : 'N/A' },
    { name: 'Market Feed API Key', status: scannerConfig.apiKey ? 'configured' : 'optional', lastSync: 'N/A' },
    { name: 'Historical Candle Feed', status: 'missing', lastSync: 'N/A' },
    { name: 'Execution/Orders API', status: 'missing', lastSync: 'N/A' },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-primary" /> Settings & Integrations
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Trading Parameters</h2>
          {[
            { label: 'Daily Target ($)', value: dailyTarget, set: setDailyTarget },
            { label: 'Max Daily Loss ($)', value: maxLoss, set: setMaxLoss },
            { label: 'Per-Trade Risk ($)', value: perTradeRisk, set: setPerTradeRisk },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <input type="number" value={value} onChange={(e) => set(+e.target.value)} className="w-full bg-surface-2 border border-border rounded px-3 py-2 font-mono text-sm text-foreground mt-1" />
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Fee & Slippage Model</h2>
          {[
            { label: 'Maker Fee (¢/contract)', value: makerFee, set: setMakerFee },
            { label: 'Taker Fee (¢/contract)', value: takerFee, set: setTakerFee },
            { label: 'Slippage Assumption (¢/contract)', value: slippage, set: setSlippage },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <input type="number" step="0.5" value={value} onChange={(e) => set(+e.target.value)} className="w-full bg-surface-2 border border-border rounded px-3 py-2 font-mono text-sm text-foreground mt-1" />
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Plug className="w-4 h-4 text-primary" /> Data Connectors</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {connectors.map((c) => (
              <div key={c.name} className="flex items-center justify-between bg-surface-2 rounded-lg p-3">
                <div>
                  <span className="text-xs font-medium text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground block">Status detail: {c.lastSync}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.status === 'configured' ? 'bg-profit/15 text-profit' : 'bg-muted text-muted-foreground'}`}>{c.status}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">Production surfaces only live API responses. Missing connectors now show explicit missing state instead of sample data.</p>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Notification Preferences</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['Signal Alerts', 'Scanner Feed Errors', 'Risk Warnings'].map((n) => (
              <label key={n} className="flex items-center gap-3 bg-surface-2 rounded-lg p-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-primary" />
                <span className="text-xs text-foreground">{n}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
