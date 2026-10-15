import React, { useState } from 'react';
import { Sliders, Shield, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { ExecutionMode } from '../types';

export const PreferencesView: React.FC = () => {
  const [mode, setMode] = useState<ExecutionMode>('APPROVAL_REQUIRED');
  const [maxPerDay, setMaxPerDay] = useState(15);
  const [targetTitles, setTargetTitles] = useState('Staff AI Engineer, Lead Full Stack Engineer, Systems Architect');
  const [blacklist, setBlacklist] = useState('Unvetted Agencies, Crypto Scams');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Automation & Policy Preferences
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-medium">
              Safety First
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure agent operating boundaries, execution modes, and submission gating policies.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 transition-all self-start sm:self-auto"
        >
          {saved ? 'Preferences Saved!' : 'Save Preferences'}
        </button>
      </div>

      {/* Mode Selector */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-400" />
          Application Execution Mode
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => setMode('PREPARE_ONLY')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              mode === 'PREPARE_ONLY'
                ? 'bg-brand-950/40 border-brand-500 shadow-lg'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white mb-1">PREPARE_ONLY</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Generates grounded documents, tailored answers, and match paths without submitting to any ATS.
            </p>
          </div>

          <div
            onClick={() => setMode('APPROVAL_REQUIRED')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              mode === 'APPROVAL_REQUIRED'
                ? 'bg-brand-950/40 border-brand-500 shadow-lg'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
              <span>APPROVAL_REQUIRED</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300 font-bold">Default</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Prepares the application and prompts the candidate to review and approve exact answers before sending.
            </p>
          </div>

          <div
            onClick={() => setMode('AUTO_APPLY')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              mode === 'AUTO_APPLY'
                ? 'bg-brand-950/40 border-brand-500 shadow-lg'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
              <span>AUTO_APPLY</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">Pro</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Submits directly only when all requirements have verified graph evidence and integration permits automation.
            </p>
          </div>
        </div>
      </div>

      {/* Constraints & Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">Maximum Submissions Per Day</label>
          <input
            type="number"
            value={maxPerDay}
            onChange={e => setMaxPerDay(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
          />
          <p className="text-[11px] text-slate-500">Safeguards against excessive automated submissions.</p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">Excluded Companies / Blacklist</label>
          <input
            type="text"
            value={blacklist}
            onChange={e => setBlacklist(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
          />
          <p className="text-[11px] text-slate-500">Comma-separated employers to automatically bypass.</p>
        </div>
      </div>
    </div>
  );
};
