import { useLocation, Link } from 'react-router-dom';
import { KSOLogo } from '@/components/KSOLogo';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard, BarChart3, FlaskConical, BookOpen, Settings, LogOut, ChevronLeft, ChevronRight, Users,
  LayoutDashboard, FlaskConical, BookOpen, Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/strategy', icon: FlaskConical, label: 'Strategy Lab' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/smart-money', icon: Users, label: 'Smart Money' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const { logout, mode } = useApp();
  const [collapsed, setCollapsed] = useState(false);

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
