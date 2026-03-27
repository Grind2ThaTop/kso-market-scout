import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AppContextType {
  isLoggedIn: boolean;
  session: Session | null;
  isAdmin: boolean;
  mode: 'paper';
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AppContext = createContext<AppContextType>({
  isLoggedIn: false,
  session: null,
  isAdmin: false,
  mode: 'paper',
  login: async () => ({}),
  logout: () => {},
});

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        // Check admin role (defer to avoid deadlock)
        setTimeout(async () => {
          const { data } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'admin')
            .maybeSingle();
          setIsAdmin(!!data);
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
    </div>;
  }

  return (
    <AppContext.Provider
      value={{
        isLoggedIn: !!session,
        session,
        isAdmin,
        mode: 'paper',
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
