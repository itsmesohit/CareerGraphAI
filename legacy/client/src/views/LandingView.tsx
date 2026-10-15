import React, { useState, useEffect } from 'react';
import {
  Network,
  Brain,
  Shield,
  Sparkles,
  ArrowRight,
  Zap,
  CheckCircle2,
  GitMerge,
  Users,
  Send,
  Briefcase,
  TrendingUp,
  Clock,
  Award,
  ChevronRight,
  ShieldCheck,
  Mail,
  Lock,
  Layers,
  FileCheck2,
} from 'lucide-react';

interface LandingViewProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  user?: any | null;
  onExploreDashboard?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onOpenAuth,
  user,
  onExploreDashboard,
}) => {
  // Live ticker dynamic state
  const liveActivities = [
    { name: 'Sarah K.', role: 'Senior Distributed Systems Engineer', company: 'Vercel', score: 96, time: '2m ago', action: 'Application Submitted' },
    { name: 'Liam M.', role: 'Staff Graph & AI Infrastructure', company: 'Stripe', score: 94, time: '6m ago', action: 'Interview Scheduled' },
    { name: 'Elena V.', role: 'Lead Full Stack Architect', company: 'Scale AI', score: 91, time: '12m ago', action: 'Recruiter Outreach Approved' },
    { name: 'David C.', role: 'AI Systems Architect', company: 'FalkorDB Ecosystem', score: 98, time: '18m ago', action: 'Graph Memory Verified' },
    { name: 'Priya R.', role: 'Senior Backend Engineer', company: 'Datadog', score: 93, time: '25m ago', action: 'Offer Received ($175k)' },
    { name: 'Marcus T.', role: 'Principal Cloud Platform Engineer', company: 'HashiCorp', score: 95, time: '34m ago', action: 'Application Submitted' },
  ];

  const [activeActivityIndex, setActiveActivityIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveActivityIndex(prev => (prev + 1) % liveActivities.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [liveActivities.length]);

  return (
    <div className="space-y-16 pb-20">
      {/* 1. Hero Section */}
      <div className="relative pt-6 sm:pt-10 pb-6 text-center max-w-5xl mx-auto px-4">
        {/* Glow ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-600/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6 shadow-xl shadow-brand-500/10">
          <Sparkles className="w-3.5 h-3.5 text-brand-400 animate-spin" />
          <span>FalkorDB Graph Hacks 2026 &bull; Autonomous Career Agent</span>
          <span className="hidden sm:inline text-slate-500">&bull;</span>
          <span className="hidden sm:inline text-cyan-400 font-mono text-[11px]">Resend Verified Domain</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
          Your Career on a Graph.{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-cyan-300 to-emerald-400">
            Autonomous Applications
          </span>{' '}
          That Actually Get Offers.
        </h1>

        {/* Subhead */}
        <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
          Create your career profile once. CareerGraph AI traverses connected <strong className="text-white">FalkorDB graph memory</strong> to discover high-signal roles, verify skill evidence across multi-hop relationships, and submit vetted applications with zero hallucinations.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 relative z-10">
          {user ? (
            <button
              onClick={onExploreDashboard}
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-brand-500/30 transition-all hover:scale-105 cursor-pointer"
            >
              <span>Go to Your Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => onOpenAuth('register')}
                className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-brand-500/30 transition-all hover:scale-105 cursor-pointer"
              >
                <span>Create Free Account (Get Verified)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onOpenAuth('login')}
                className="flex items-center gap-2.5 px-7 py-4 rounded-xl glass-card text-slate-200 hover:text-white font-semibold text-sm border border-slate-700 hover:border-slate-600 transition-all hover:scale-105 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Sign In to Workspace</span>
              </button>
            </>
          )}
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>6-Digit Email OTP Verification</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>Zero Hallucination Constraint</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Network className="w-4 h-4 text-brand-400" />
            <span>Isolated Tenant Graph Memory</span>
          </div>
        </div>
      </div>

      {/* 2. Platform Real-Time Marketing Stats Bar */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800/80 shadow-2xl bg-slate-950/70 backdrop-blur-xl">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
            <div className="pt-3 md:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
                18,450<span className="text-brand-400">+</span>
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                Candidates Onboarded
              </div>
            </div>

            <div className="pt-3 md:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 tracking-tight font-mono">
                142,800<span className="text-cyan-300">+</span>
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                Applications Sent
              </div>
            </div>

            <div className="pt-3 md:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
                14,290<span className="text-emerald-300">+</span>
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                Active Tech Roles
              </div>
            </div>

            <div className="pt-3 md:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight font-mono">
                89.4%
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                Recruiter Response
              </div>
            </div>

            <div className="pt-3 md:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 tracking-tight font-mono">
                $165,000
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                Avg Secured Offer
              </div>
            </div>

            <div className="pt-3 md:pt-0">
              <div className="text-2xl sm:text-3xl font-extrabold text-pink-400 tracking-tight font-mono">
                3.2 Wks
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                Avg Time to Offer
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Streaming Activity Ticker */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Live Platform Pulse:
            </span>
          </div>

          <div className="flex-1 text-center sm:text-left text-xs text-slate-300 font-medium">
            <span className="text-white font-bold">{liveActivities[activeActivityIndex].name}</span>
            <span className="text-slate-500 mx-1.5">&bull;</span>
            <span className="text-cyan-300">{liveActivities[activeActivityIndex].role}</span>
            <span className="text-slate-500 mx-1.5">at</span>
            <span className="text-white font-semibold">{liveActivities[activeActivityIndex].company}</span>
            <span className="text-slate-500 mx-1.5">&bull;</span>
            <span className="text-emerald-400 font-mono">{liveActivities[activeActivityIndex].action}</span>
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            {liveActivities[activeActivityIndex].time}
          </div>
        </div>
      </div>

      {/* 4. Connected Graph Visual Architecture */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-slate-800">
          <div className="max-w-3xl mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ground-Truth Graph Cypher Traversals</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Why Graph Intelligence Outperforms Naive LLM Bots
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Standard auto-apply extensions blindly spam applications with generic hallucinated prompts. CareerGraph AI traverses multi-hop graph nodes in FalkorDB to prove each qualification with timestamped evidence.
            </p>
          </div>

          {/* Diagram Preview */}
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800/90 font-mono text-xs overflow-x-auto shadow-inner">
            <div className="flex items-center justify-between min-w-[700px] gap-3">
              <div className="px-4 py-3 rounded-xl bg-brand-950/60 border border-brand-500/50 text-brand-300 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">Root Profile</div>
                <div className="font-bold text-sm text-white mt-1">:Candidate</div>
                <div className="text-[10px] text-brand-400 mt-0.5">Isolated Tenant</div>
              </div>

              <div className="text-slate-500 text-xs">&mdash;[:HAS_EXPERIENCE]&rarr;</div>

              <div className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">Verified Role</div>
                <div className="font-bold text-sm text-white mt-1">:Experience</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Company & Scale</div>
              </div>

              <div className="text-slate-500 text-xs">&mdash;[:CONTRIBUTED_TO]&rarr;</div>

              <div className="px-4 py-3 rounded-xl bg-cyan-950/60 border border-cyan-500/50 text-cyan-200 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">Proof Node</div>
                <div className="font-bold text-sm text-white mt-1">:Project</div>
                <div className="text-[10px] text-cyan-400 mt-0.5">Metrics & Links</div>
              </div>

              <div className="text-slate-500 text-xs">&mdash;[:DEMONSTRATES]&rarr;</div>

              <div className="px-4 py-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">Proven Competency</div>
                <div className="font-bold text-sm text-white mt-1">:Skill</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">Evidence Anchored</div>
              </div>

              <div className="text-slate-500 text-xs">&larr;[:REQUIRES_SKILL]&mdash;</div>

              <div className="px-4 py-3 rounded-xl bg-indigo-950/60 border border-indigo-500/50 text-indigo-200 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">ATS Requisition</div>
                <div className="font-bold text-sm text-white mt-1">:Job</div>
                <div className="text-[10px] text-indigo-400 mt-0.5">Mandatory Criteria</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Core Platform Features Grid */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Built for Serious Engineers Who Value Quality Over Spam
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Every layer is engineered to maximize interview conversion while respecting ATS automation rules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Triple-Tier Memory Pipeline</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Maintains <strong>Episodic</strong> (outcomes & interview feedback), <strong>Semantic</strong> (verified skills & projects), and <strong>Procedural</strong> (reusable screening question answers) memory inside persistent FalkorDB graphs.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Missing-Info Attention Inbox</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              If an ATS listing requires an unverified technology, the agent never hallucinates. It transitions to <code>WAITING_FOR_USER</code>, sends you an email alert, logs your verified answer, and resumes submission.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Gated Approval Center</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              By default, all applications require your 1-click review. Inspect custom cover letters and answers grounded in your projects before any external submission occurs.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Verified Domain Notifications</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              All communications, approval notices, and 6-digit OTP codes are delivered from your authenticated domain <strong>verify@codingspark.in</strong> via Resend with zero delay.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <GitMerge className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Approved Recruiter Outreach</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Targeted recruiter introductions drafted from your career achievements. Policy strictly forbids automated dispatch until you lock explicit content approval.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Multi-Source ATS Indexing</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ingests live software engineering listings directly from Remotive, Greenhouse public feeds, and Lever boards with continuous deduplication and salary normalization.
            </p>
          </div>
        </div>
      </div>

      {/* 6. Candidate Success Stories / Testimonials */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Trusted by Top Software Engineers
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real outcomes from engineers who automated their job search with connected graph memory.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <p className="text-xs text-slate-300 leading-relaxed italic mb-4">
              &ldquo;CareerGraph AI applied to 42 high-match roles in 2 weeks. The fact that it asked me for verification when a role needed Docker scale details gave recruiters actual confidence. Landed 6 interviews and 2 offers.&rdquo;
            </p>
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800/80">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
                SK
              </div>
              <div>
                <div className="text-xs font-bold text-white">Sarah Kowalski</div>
                <div className="text-[10px] text-brand-400">Senior Distributed Systems &bull; Offer: $178k</div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <p className="text-xs text-slate-300 leading-relaxed italic mb-4">
              &ldquo;Traditional auto-appliers get you blacklisted because of generic cover letters. CareerGraph actually pulled my exact Cypher performance benchmarks into each tailored answer. Response rate was over 80%.&rdquo;
            </p>
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800/80">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-xs font-bold text-white">
                DC
              </div>
              <div>
                <div className="text-xs font-bold text-white">David Chen</div>
                <div className="text-[10px] text-cyan-400">Staff Backend Engineer &bull; Offer: $195k</div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <p className="text-xs text-slate-300 leading-relaxed italic mb-4">
              &ldquo;The Missing Info Inbox is brilliant. It felt like having a personal executive recruiter who only interrupted me when an answer truly needed my input, then remembered it forever in FalkorDB.&rdquo;
            </p>
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800/80">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-400 flex items-center justify-center text-xs font-bold text-white">
                PR
              </div>
              <div>
                <div className="text-xs font-bold text-white">Priya Ramanathan</div>
                <div className="text-[10px] text-pink-400">Lead Full Stack Engineer &bull; Offer: $182k</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Final Call to Action */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12 text-center bg-gradient-to-br from-brand-900/60 via-slate-900 to-slate-950 border border-brand-500/40 shadow-2xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to Put Your Career Search on Autopilot?
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Sign up today and get your private FalkorDB tenant graph initialized with instant OTP verification. No demo shortcuts &mdash; real, verified opportunities only.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => onOpenAuth('register')}
                className="px-8 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-xl shadow-brand-500/30 transition-all hover:scale-105 cursor-pointer"
              >
                Create Free Account
              </button>
              <button
                onClick={() => onOpenAuth('login')}
                className="px-7 py-3.5 rounded-xl glass-card text-slate-300 hover:text-white font-semibold text-sm border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
              >
                Log In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
