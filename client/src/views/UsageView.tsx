import React, { useState } from 'react';
import { CreditCard, CheckCircle2, Zap, Shield, Sparkles } from 'lucide-react';

export const UsageView: React.FC = () => {
  const [currentPlan, setCurrentPlan] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('PRO');
  const [upgradedMsg, setUpgradedMsg] = useState('');

  const handleSelectPlan = (plan: 'FREE' | 'PRO' | 'ENTERPRISE') => {
    setCurrentPlan(plan);
    setUpgradedMsg(`Successfully switched subscription to ${plan} Plan! Quotas updated.`);
    setTimeout(() => setUpgradedMsg(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Subscription & Usage Quotas
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-medium">
              {currentPlan} Tier
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent SaaS usage meters, billing status, and plan management.
          </p>
        </div>
      </div>

      {upgradedMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{upgradedMsg}</span>
        </div>
      )}

      {/* Quota Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Daily Applications</span>
            <span className="font-bold text-white">4 / 25</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full" style={{ width: '16%' }} />
          </div>
          <p className="text-[11px] text-slate-500">Resets daily at 00:00 UTC</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Monthly AI Reasoning Tokens</span>
            <span className="font-bold text-white">18,450 / 100,000</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: '18.4%' }} />
          </div>
          <p className="text-[11px] text-slate-500">81,550 tokens remaining this cycle</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>FalkorDB Context Nodes</span>
            <span className="font-bold text-white">Unlimited</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: '100%' }} />
          </div>
          <p className="text-[11px] text-slate-500">Full episodic & semantic graph persistence</p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Free Plan */}
        <div className={`glass-card p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
          currentPlan === 'FREE' ? 'border-brand-500 shadow-xl' : 'border-slate-800'
        }`}>
          <div>
            <div className="text-sm font-bold text-white">Free Starter</div>
            <div className="text-2xl font-black text-white mt-1">$0 <span className="text-xs text-slate-400 font-normal">/ mo</span></div>
            <p className="text-xs text-slate-400 mt-2">Essential exploration and profile graph creation.</p>

            <ul className="mt-4 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ Up to 3 applications / day</li>
              <li className="flex items-center gap-2">✓ Remotive live job discovery</li>
              <li className="flex items-center gap-2">✓ Basic match score calculation</li>
            </ul>
          </div>

          <button
            onClick={() => handleSelectPlan('FREE')}
            disabled={currentPlan === 'FREE'}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentPlan === 'FREE' ? 'bg-slate-800 text-slate-400' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {currentPlan === 'FREE' ? 'Current Plan' : 'Downgrade to Free'}
          </button>
        </div>

        {/* Pro Plan */}
        <div className={`glass-panel p-6 rounded-2xl border-2 flex flex-col justify-between space-y-4 relative ${
          currentPlan === 'PRO' ? 'border-brand-500 shadow-2xl' : 'border-slate-800'
        }`}>
          <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-bold uppercase tracking-wider">
            Most Popular
          </div>

          <div>
            <div className="text-sm font-bold text-white">Pro Candidate</div>
            <div className="text-2xl font-black text-white mt-1">$29 <span className="text-xs text-slate-400 font-normal">/ mo</span></div>
            <p className="text-xs text-slate-400 mt-2">Continuous discovery, auto-drafting, and approval workflows.</p>

            <ul className="mt-4 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ 25 applications / day</li>
              <li className="flex items-center gap-2">✓ Multi-hop FalkorDB reasoning path</li>
              <li className="flex items-center gap-2">✓ Missing-information inbox & auto resume</li>
              <li className="flex items-center gap-2">✓ Recruiter outreach drafts & Gmail OAuth</li>
              <li className="flex items-center gap-2">✓ 100,000 monthly AI reasoning tokens</li>
            </ul>
          </div>

          <button
            onClick={() => handleSelectPlan('PRO')}
            disabled={currentPlan === 'PRO'}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentPlan === 'PRO' ? 'bg-brand-600 text-white cursor-default' : 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg'
            }`}
          >
            {currentPlan === 'PRO' ? 'Current Plan (Active)' : 'Upgrade to Pro'}
          </button>
        </div>

        {/* Enterprise */}
        <div className={`glass-card p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
          currentPlan === 'ENTERPRISE' ? 'border-brand-500 shadow-xl' : 'border-slate-800'
        }`}>
          <div>
            <div className="text-sm font-bold text-white">Autonomous Executive</div>
            <div className="text-2xl font-black text-white mt-1">$99 <span className="text-xs text-slate-400 font-normal">/ mo</span></div>
            <p className="text-xs text-slate-400 mt-2">Unlimited agent concurrency and priority integrations.</p>

            <ul className="mt-4 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">✓ Unlimited daily applications</li>
              <li className="flex items-center gap-2">✓ Auto-Apply permitted ATS workflows</li>
              <li className="flex items-center gap-2">✓ Dedicated FalkorDB tenant instance</li>
              <li className="flex items-center gap-2">✓ Custom model fine-tuning & priority support</li>
            </ul>
          </div>

          <button
            onClick={() => handleSelectPlan('ENTERPRISE')}
            disabled={currentPlan === 'ENTERPRISE'}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentPlan === 'ENTERPRISE' ? 'bg-slate-800 text-slate-400' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {currentPlan === 'ENTERPRISE' ? 'Current Plan' : 'Upgrade to Executive'}
          </button>
        </div>
      </div>
    </div>
  );
};
