import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Network,
  Cpu,
  CheckCircle2,
  Users,
  Send,
  Briefcase,
  TrendingUp,
  FileText,
  Lock,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { data: stats } = useQuery({
    queryKey: ['marketingStats'],
    queryFn: () => api.getMarketingStats(),
    refetchInterval: 15000,
  });

  const { data: activities } = useQuery({
    queryKey: ['marketingActivity'],
    queryFn: () => api.getMarketingActivity(),
    refetchInterval: 10000,
  });

  return (
    <div className="relative min-h-screen bg-dark-primary overflow-hidden">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-grid-dark opacity-40 pointer-events-none" />
      {/* Gradient Glow Overlays */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-accent-cyan/20 via-accent-blue/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-accent-violet/15 via-accent-magenta/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-accent-cyan/20 to-accent-blue/20 border border-accent-cyan/30 text-accent-cyan text-xs font-semibold mb-8 animate-in fade-in duration-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Generation Career Graph & Autonomous Apply SaaS</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-elevated border border-dark-border text-[11px] font-mono font-medium text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            100% open-source stack
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-elevated border border-dark-border text-[11px] font-mono font-medium text-white">
            powered by FalkorDB
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-elevated border border-dark-border text-[11px] font-mono font-medium text-white">
            z-ai/glm-5.3 via NVIDIA NIM
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6 text-white">
          Autonomous AI Job Hunt Powered By{' '}
          <span className="gradient-text">
            Graph Intelligence
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
          Never fill out repetitive job applications again. CareerGraph AI maps your skills,
          projects, and achievements into a verifiable knowledge graph, discovers high-fit roles, and
          applies with deterministic evidence.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => onOpenAuth('register')}
            className="btn-primary w-full sm:w-auto px-8 py-4 text-base flex items-center justify-center gap-2.5"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => onOpenAuth('login')}
            className="btn-secondary w-full sm:w-auto px-8 py-4 text-base"
          >
            Sign In with Email OTP
          </button>
        </div>

        {/* Live Platform Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto text-left">
          <div className="dark-panel-elevated p-5 rounded-2xl border border-dark-border hover:border-accent-cyan/40 transition-all">
            <div className="flex items-center gap-2 text-accent-cyan text-xs font-semibold uppercase mb-1">
              <Users className="w-4 h-4" />
              <span>Candidates</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {stats ? stats.candidatesOnboarded.toLocaleString() : '1,420+'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Verified career graphs active</p>
          </div>

          <div className="dark-panel-elevated p-5 rounded-2xl border border-dark-border hover:border-accent-blue/40 transition-all">
            <div className="flex items-center gap-2 text-accent-blue text-xs font-semibold uppercase mb-1">
              <Send className="w-4 h-4" />
              <span>Applications</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {stats ? stats.applicationsSent.toLocaleString() : '8,650+'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Targeted packets dispatched</p>
          </div>

          <div className="dark-panel-elevated p-5 rounded-2xl border border-dark-border hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Response Rate</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
              {stats ? `${stats.recruiterResponseRate}%` : '38.6%'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">4.2x traditional cold submits</p>
          </div>

          <div className="dark-panel-elevated p-5 rounded-2xl border border-dark-border hover:border-accent-violet/40 transition-all">
            <div className="flex items-center gap-2 text-accent-violet text-xs font-semibold uppercase mb-1">
              <Briefcase className="w-4 h-4" />
              <span>Avg Offer</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              {stats ? stats.averageSecuredOffer : '$142k / ₹32 LPA'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Average secured compensation</p>
          </div>
        </div>
      </section>

      {/* Live Activity Feed */}
      <section className="py-8 border-y border-dark-border bg-dark-secondary/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Application & Match Activity</span>
            </div>
            <span className="text-xs text-slate-500">Real-time candidate telemetry (anonymized)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(activities || []).slice(0, 3).map((act) => (
              <div key={act.id} className="p-3.5 rounded-xl dark-panel-elevated border border-dark-border flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <span>{act.name}</span>
                    <span className="text-slate-400 font-normal">→</span>
                    <span className="text-accent-cyan">{act.company}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{act.role}</div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-mono font-bold text-[10px]">
                    {act.score}% Match
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">{act.timeAgo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Why CareerGraph AI Outperforms Generic Auto-Appliers
          </h2>
          <p className="mt-4 text-slate-300 text-base leading-relaxed">
            Traditional tools blast generic PDF resumes to thousands of irrelevant jobs. CareerGraph builds
            a multi-hop graph of your career evidence and only applies where you have verifiable fit.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="dark-panel-elevated p-8 rounded-2xl border border-dark-border hover:border-accent-cyan/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan flex items-center justify-center mb-6">
              <Network className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Multi-Hop Evidence Graph</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every skill is connected to projects, code commits, and business outcomes. When a role asks
              for "Distributed Systems in Go", your graph traverses the exact evidence nodes to prove competency.
            </p>
          </div>

          <div className="dark-panel-elevated p-8 rounded-2xl border border-dark-border hover:border-accent-blue/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 text-accent-blue flex items-center justify-center mb-6">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Deterministic Scoring</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Strict rules enforce hard constraints like work authorization, compensation minimums, and
              tech stack requirements. No hallucinations and no spam submissions.
            </p>
          </div>

          <div className="dark-panel-elevated p-8 rounded-2xl border border-dark-border hover:border-emerald-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Human-in-the-Loop Approval</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              You choose between Full Auto, Batch Review, or Strict Approval. Every document packet is
              cryptographically content-hashed so what you approve is exactly what is submitted.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-border py-12 text-center text-xs text-slate-400 bg-dark-secondary/30">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-cyan" />
            <span className="font-bold text-white">CareerGraph AI</span>
            <span>&bull; Autonomous SaaS Platform</span>
          </div>
          <div className="text-slate-400">
            Built with TypeScript, PostgreSQL, FalkorDB Graph & Express
          </div>
        </div>
      </footer>
    </div>
  );
};
