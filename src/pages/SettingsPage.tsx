import { tradingProfile } from '@/data/demoData';
import { useState } from 'react';
import { Settings as SettingsIcon, Plug, DollarSign, Shield, Bell } from 'lucide-react';

const SettingsPage = () => {
  const [dailyTarget, setDailyTarget] = useState(tradingProfile.dailyTarget);
  const [maxLoss, setMaxLoss] = useState(tradingProfile.maxDailyLoss);
  const [perTradeRisk, setPerTradeRisk] = useState(tradingProfile.perTradeRisk);
  const [makerFee, setMakerFee] = useState(tradingProfile.feeModel.maker * 100);
  const [takerFee, setTakerFee] = useState(tradingProfile.feeModel.taker * 100);
  const [slippage, setSlippage] = useState(tradingProfile.slippageModel * 100);

  const connectors = [
    { name: 'Market Data Provider A', status: 'placeholder', lastSync: 'N/A' },
    { name: 'Market Data Provider B', status: 'placeholder', lastSync: 'N/A' },
    { name: 'Historical Data Feed', status: 'placeholder', lastSync: 'N/A' },
    { name: 'Notification Service', status: 'placeholder', lastSync: 'N/A' },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-primary" /> Settings & Integrations
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trading Parameters */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Trading Parameters
          </h2>
          {[
            { label: 'Daily Target ($)', value: dailyTarget, set: setDailyTarget },
            { label: 'Max Daily Loss ($)', value: maxLoss, set: setMaxLoss },
            { label: 'Per-Trade Risk ($)', value: perTradeRisk, set: setPerTradeRisk },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <input type="number" value={value} onChange={e => set(+e.target.value)} className="w-full bg-surface-2 border border-border rounded px-3 py-2 font-mono text-sm text-foreground mt-1" />
            </div>
          ))}
        </div>

        {/* Fee Model */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Fee & Slippage Model
          </h2>
          {[
            { label: 'Maker Fee (¢/contract)', value: makerFee, set: setMakerFee },
            { label: 'Taker Fee (¢/contract)', value: takerFee, set: setTakerFee },
            { label: 'Slippage Assumption (¢/contract)', value: slippage, set: setSlippage },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <input type="number" step="0.5" value={value} onChange={e => set(+e.target.value)} className="w-full bg-surface-2 border border-border rounded px-3 py-2 font-mono text-sm text-foreground mt-1" />
            </div>
          ))}
          <div className="bg-surface-2 rounded p-3 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Note:</strong> These are assumptions used in paper trade calculations. Actual fees and slippage will vary by platform. No real execution is enabled in this MVP.</p>
          </div>
        </div>

        {/* Connectors */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Plug className="w-4 h-4 text-primary" /> Data Connectors
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {connectors.map(c => (
              <div key={c.name} className="flex items-center justify-between bg-surface-2 rounded-lg p-3">
                <div>
                  <span className="text-xs font-medium text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground block">Last sync: {c.lastSync}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase">{c.status}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Connector slots are architecture-ready for future data integrations. Currently using seeded demo data.
          </p>
        </div>

        {/* Notifications */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Notification Preferences
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['Signal Alerts', 'Trade Confirmations', 'Risk Warnings'].map(n => (
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
