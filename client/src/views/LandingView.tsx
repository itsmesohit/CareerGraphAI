import React from 'react';
import { Network, Brain, Shield, Sparkles, ArrowRight, Zap, CheckCircle2, GitMerge } from 'lucide-react';

interface LandingViewProps {
  onStartDemo: () => void;
  onExploreGraph: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onStartDemo, onExploreGraph }) => {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <div className="relative pt-8 pb-12 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6 shadow-lg shadow-brand-500/10">
          <Sparkles className="w-4 h-4 text-brand-400 animate-spin" />
          <span>FalkorDB Graph Hacks Hackathon Entry</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
          Autonomous Career Agent Powered by{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-cyan-400 to-emerald-400">
            FalkorDB Graph Memory
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Create your career profile once. Your agent continuously discovers relevant opportunities, traverses multi-hop graph evidence, pauses when facts are missing, and applies through permitted integrations with your approval.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onStartDemo}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-brand-500/25 transition-all hover:scale-105"
          >
            <span>Launch Live Discovery Demo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onExploreGraph}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl glass-card text-slate-200 hover:text-white font-semibold text-sm border border-slate-700/80 hover:border-slate-600 transition-all hover:scale-105"
          >
            <Network className="w-4 h-4 text-cyan-400" />
            <span>Inspect FalkorDB Knowledge Graph</span>
          </button>
        </div>
      </div>

      {/* Tracks Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-brand-500 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-400">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Primary Track</span>
              <h3 className="text-lg font-bold text-white">Agent Memory & Coordination</h3>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            FalkorDB maintains <strong>Episodic</strong> (session outcomes, user corrections), <strong>Semantic</strong> (verified skills, projects, provenance), and <strong>Procedural</strong> (reusable question rules) memory. Handoffs between Orchestrator, Matching, Application, and Outreach agents are persisted directly in graph nodes.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-cyan-500 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
              <GitMerge className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Secondary Track</span>
              <h3 className="text-lg font-bold text-white">Agents That Act on Connected Data</h3>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Evaluates job match suitability through multi-hop graph queries traversing:
            <code className="text-xs bg-slate-950 px-2 py-1 rounded block mt-2 font-mono text-cyan-300 border border-slate-800">
              (Job) → (Requirement) → (Skill) ← (Project) ← (Experience) ← (Candidate)
            </code>
            Every recommendation produces an explainable graph path with verifiable evidence.
          </p>
        </div>
      </div>

      {/* Core Architectural Pillars */}
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white">Why FalkorDB Is Essential, Not Decorative</h2>
          <p className="text-sm text-slate-400 mt-1">
            Built from the ground up around real graph traversals and memory persistence.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="glass-card p-5 rounded-2xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-3" />
            <h4 className="font-bold text-white text-sm mb-1.5">No Hallucinated Qualifications</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every prepared answer and match score is grounded strictly in verified nodes in FalkorDB with provenance timestamps.
            </p>
          </div>

          <div className="glass-card p-5 rounded-2xl">
            <Zap className="w-6 h-6 text-amber-400 mb-3" />
            <h4 className="font-bold text-white text-sm mb-1.5">Missing-Information Inbox</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              When a job mandates an unverified skill, the agent pauses at <code>WAITING_FOR_USER</code>, asks for confirmation, saves to memory, and resumes.
            </p>
          </div>

          <div className="glass-card p-5 rounded-2xl">
            <Shield className="w-6 h-6 text-brand-400 mb-3" />
            <h4 className="font-bold text-white text-sm mb-1.5">Approval-Locked Outreach</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recruiter outreach emails cannot be dispatched without explicit user review. Any post-approval edits automatically invalidate approval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
