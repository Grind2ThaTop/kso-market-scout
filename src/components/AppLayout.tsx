import { useLocation, Link } from 'react-router-dom';
import { KSOLogo } from '@/components/KSOLogo';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard,
  FlaskConical,
  BookOpen,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/strategy', icon: FlaskConical, label: 'Strategy Lab' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/smart-money', icon: Users, label: 'Smart Money' },
  { to: '/auto-trade', icon: Zap, label: 'Auto-Trade' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const { logout, mode } = useApp();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Mobile layout: top bar + slide-out drawer
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Mobile top bar */}
        <header className="bg-sidebar/95 backdrop-blur border-b border-sidebar-border flex items-center justify-between px-3 py-2 shrink-0 z-40">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-md hover:bg-sidebar-accent">
              <Menu className="w-5 h-5 text-sidebar-foreground" />
            </button>
            <KSOLogo size={24} />
            <span className="text-sm font-semibold text-sidebar-accent-foreground">KSO</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase">{mode}</span>
        </header>

        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <aside className="relative w-64 bg-sidebar/98 backdrop-blur border-r border-sidebar-border flex flex-col z-50 animate-in slide-in-from-left duration-200">
              <div className="p-3 flex items-center justify-between border-b border-sidebar-border">
                <div className="flex items-center gap-2">
                  <KSOLogo size={28} />
                  <span className="text-sm font-semibold text-sidebar-accent-foreground">KSO Market Scout</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded-md hover:bg-sidebar-accent">
                  <X className="w-5 h-5 text-sidebar-foreground" />
                </button>
              </div>
              <nav className="flex-1 p-2 space-y-1">
                {navItems.map(({ to, icon: Icon, label }) => {
                  const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
                  return (
                    <Link key={to} to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${active ? 'bg-sidebar-accent text-sidebar-primary border border-primary/25' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-2 border-t border-sidebar-border">
                <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full">
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
          <footer className="border-t border-border px-3 py-1.5 text-center shrink-0">
            <p className="text-[9px] text-muted-foreground">
              KSO Market Scout — Informational & simulation software only. Not investment advice.
            </p>
          </footer>
        </main>
      </div>
    );
  }

  // Desktop layout: sidebar
  return (
    <div className="min-h-screen bg-background flex">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-sidebar/95 backdrop-blur border-r border-sidebar-border flex flex-col transition-all duration-200 shrink-0`}>
        <div className="p-3 flex items-center gap-2 border-b border-sidebar-border">
          <KSOLogo size={28} />
          {!collapsed && <span className="text-sm font-semibold text-sidebar-accent-foreground truncate">KSO Market Scout</span>}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <Link key={to} to={to} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? 'bg-sidebar-accent text-sidebar-primary border border-primary/25' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border space-y-1">
          <div className={`flex items-center gap-2 px-3 py-1 ${collapsed ? 'justify-center' : ''}`}>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary uppercase">{mode}</span>
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
          </button>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full">
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        {children}
        <footer className="border-t border-border px-4 py-2 text-center shrink-0">
          <p className="text-[10px] text-muted-foreground">
            KSO Market Scout — Informational & simulation software only. Not investment advice. Markets involve risk.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default AppLayout;
