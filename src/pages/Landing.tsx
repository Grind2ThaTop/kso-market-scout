import { useApp } from '@/context/AppContext';
import { KSOLogo } from '@/components/KSOLogo';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Target, BookOpen, Shield } from 'lucide-react';

const Landing = () => {
  const { login } = useApp();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KSOLogo size={36} />
          <span className="text-lg font-semibold text-foreground">KSO Market Scout</span>
        </div>
        <button onClick={login} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity">
          Sign In
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              Prediction Market<br />
              <span className="text-primary">Analytics & Paper Trading</span>
            </h1>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Identify mispriced contracts, calculate expected edge after fees, run paper trades, and track performance — all in one terminal.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button onClick={login} className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md hover:opacity-90 transition-opacity">
              Enter Demo Mode <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={login} className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground font-medium rounded-md hover:bg-surface-3 transition-colors">
              Sign In
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { icon: BarChart3, label: 'Signal Scoring' },
              { icon: Target, label: 'Trade Calculator' },
              { icon: BookOpen, label: 'Paper Trading' },
              { icon: Shield, label: 'Risk Management' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-4 text-center">
                <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                <span className="text-sm text-foreground font-medium">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
          ⚠️ <strong>Disclaimer:</strong> KSO Market Scout is informational and simulation software only. It does not provide investment advice, place live orders, or connect to user funds. Prediction markets involve risk. Past simulated performance does not guarantee future results.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
