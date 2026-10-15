import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { LogOut, LayoutDashboard, Compass, Briefcase, CheckSquare, Menu, X, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { CareerGraphLogo } from './CareerGraphLogo.js';

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/jobs', icon: Compass, label: 'Jobs' },
    { to: '/applications', icon: Briefcase, label: 'Applications' },
    { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-dark-primary/98 border-b border-dark-border shadow-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo - Premium, Always Visible */}
          <Link to="/" className="flex items-center gap-3 group transition-all">
            <div className="relative">
              {/* Animated glow ring */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent-cyan via-accent-blue to-accent-violet opacity-20 blur-lg group-hover:opacity-30 transition-opacity" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan via-accent-blue to-accent-violet p-1.5 shadow-lg">
                <CareerGraphLogo className="w-full h-full" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-lg tracking-tight text-white group-hover:text-accent-cyan transition-colors">
                  CareerGraph
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gradient-to-r from-accent-cyan to-accent-blue text-dark-primary tracking-wide">
                  AI
                </span>
              </div>
              <span className="text-[9px] text-accent-cyan/80 uppercase tracking-[0.15em] font-semibold">
                Autonomous Career Agent
              </span>
            </div>
          </Link>
          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isActive
                        ? 'text-accent-cyan'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30" />
                    )}
                    <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-accent-cyan' : ''}`} />
                    <span className="relative z-10">{label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* User Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* User Badge */}
                <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-navy-elevated border border-navy-border">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-cyan via-accent-blue to-accent-violet flex items-center justify-center text-navy-deep font-bold text-sm shadow-md">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold text-slate-100">{user.name}</span>
                    <span className="text-[10px] text-accent-cyan font-mono uppercase tracking-wide">{user.role}</span>
                  </div>
                </div>
                
                {/* Logout Button */}
                <button
                  onClick={() => logout()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 hover:border-rose-500/30 transition-all"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden lg:inline">Logout</span>
                </button>

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-navy-elevated rounded-lg transition-all"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onOpenAuth('login')}
                  className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white hover:bg-dark-elevated rounded-lg transition-all"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth('register')}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-accent-cyan to-accent-blue hover:from-accent-cyan/90 hover:to-accent-blue/90 text-white rounded-lg shadow-lg shadow-accent-cyan/20 transition-all hover:scale-105"
                >
                  <span>Get Started</span>
                  <Zap className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {user && mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-dark-border">
            <div className="flex flex-col gap-2">
              {navLinks.map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30'
                        : 'text-slate-400 hover:text-white hover:bg-dark-elevated'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

