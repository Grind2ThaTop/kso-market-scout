import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { KSOLogo } from '@/components/KSOLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Zap, LogIn, BarChart3, Target, BookOpen, Shield } from 'lucide-react';

const Landing = () => {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <KSOLogo size={36} />
            <h1 className="text-xl font-bold">KSO Market Scout</h1>
          </div>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Zap className="w-3.5 h-3.5 text-primary" /> Live prediction market intelligence
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-xs text-loss">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            <LogIn className="w-4 h-4 mr-2" />
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: BarChart3, label: 'Signal Scoring' },
            { icon: Target, label: 'Trade Calculator' },
            { icon: BookOpen, label: 'Paper Trading' },
            { icon: Shield, label: 'Risk Management' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="glass-card border border-border rounded-lg p-3 text-center">
              <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          ⚠️ Informational & simulation software only. Not investment advice.
        </p>
      </motion.div>
    </div>
  );
};

export default Landing;
