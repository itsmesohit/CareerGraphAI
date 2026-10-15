import React from 'react';
import {
  Compass,
  FileText,
  Send,
  HelpCircle,
  CheckCircle2,
  Mail,
  Network,
  Activity,
  Sliders,
  CreditCard,
  Layers,
  LogOut,
  LogIn,
  UserPlus,
} from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  pendingApprovals: number;
  missingItemsCount: number;
  falkorMode: string;
  user: any | null;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  pendingApprovals,
  missingItemsCount,
  falkorMode,
  user,
  onOpenAuth,
  onLogout,
}) => {
  const navItems = [
    { id: 'jobs', label: 'Discover Jobs', icon: Compass },
    { id: 'applications', label: 'Application Tracker', icon: Layers },
    {
      id: 'missing-info',
      label: 'Missing Info Inbox',
      icon: HelpCircle,
      badge: missingItemsCount,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'approvals',
      label: 'Approval Center',
      icon: CheckCircle2,
      badge: pendingApprovals,
      badgeColor: 'bg-brand-500',
    },
    { id: 'outreach', label: 'Recruiter Outreach', icon: Mail },
    { id: 'graph', label: 'Career Graph', icon: Network, highlight: true },
    { id: 'timeline', label: 'Agent Timeline', icon: Activity },
    { id: 'profile', label: 'Career Profile', icon: FileText },
    { id: 'integrations', label: 'Integrations', icon: Sliders },
    { id: 'usage', label: 'Subscription & Quotas', icon: CreditCard },
  ];

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'AR';

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Hackathon Badge */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-brand-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Network className="w-5 h-5 text-brand-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">
                  CareerGraph<span className="text-brand-400">.ai</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  FalkorDB Graph Hacks
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5">
                Agent Memory & Reasoning
              </p>
            </div>
          </div>

          {/* Quick status indicator */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className={`w-2 h-2 rounded-full ${falkorMode === 'LIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
              <span className="font-medium text-slate-400">FalkorDB:</span>
              <span className="font-bold text-white">{falkorMode}</span>
            </div>
          </div>

          {/* User Auth Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('profile')}
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
                    {initials}
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xs font-semibold text-white max-w-[120px] truncate">{user.name}</div>
                    <div className="text-[10px] text-brand-400 capitalize">{user.role || 'Candidate'}</div>
                  </div>
                </button>

                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs font-semibold transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('login')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In</span>
                </button>
                <button
                  onClick={() => onOpenAuth('register')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-105"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Navigation Ribbon: Hidden until authenticated */}
        {user && (
          <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/40">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 font-semibold'
                      : item.highlight
                      ? 'text-cyan-300 hover:text-white hover:bg-slate-900 border border-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : item.highlight ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white ${item.badgeColor || 'bg-brand-500'}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
