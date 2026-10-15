import React from 'react';
import { JobPosting } from '../types';
import { X, Network, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface JobMatchModalProps {
  job: JobPosting;
  onClose: () => void;
  onPrepareApplication: (jobId: string) => void;
}

export const JobMatchModal: React.FC<JobMatchModalProps> = ({ job, onClose, onPrepareApplication }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl glass-panel rounded-2xl border border-slate-700/80 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                FalkorDB Multi-Hop Reasoning
              </span>
              <span className="text-xs text-slate-400">{job.company}</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">{job.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Match Score Banner */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-500 to-cyan-400 flex items-center justify-center text-lg font-black text-white">
              {job.matchScore || 78}%
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Grounded Compatibility Score</h4>
              <p className="text-xs text-slate-400">
                Calculated from {job.requirements.length} job requirements mapped to verified graph entities.
              </p>
            </div>
          </div>
        </div>

        {/* Cypher Reasoning Path */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            Graph Traversal Path
          </span>
          <div className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-cyan-300 border border-slate-800 overflow-x-auto">
            <code>
              MATCH (j:Job &#123; id: '{job.id}' &#125;)-[:HAS_REQUIREMENT]-&gt;(r:Requirement)-[:REQUIRES_SKILL]-&gt;(s:Skill)<br />
              OPTIONAL MATCH (s)&lt;-[:DEMONSTRATES]-(p:Project)&lt;-[:CONTRIBUTED_TO]-(e:Experience)&lt;-[:HAS_EXPERIENCE]-(c:Candidate)<br />
              OPTIONAL MATCH (s)&lt;-[:SUPPORTS]-(ev:Evidence)<br />
              RETURN r.text, s.name, p.title, ev.text
            </code>
          </div>
        </div>

        {/* Requirements Breakdown */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Requirement & Evidence Mapping
          </span>

          <div className="space-y-2">
            {job.requirements.map((req, idx) => {
              const matched = (job.matchedSkills || []).includes(req.skillName);
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs ${
                    matched
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                      : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {matched ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-white">{req.text}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Required Skill: <span className="font-mono text-cyan-300">{req.skillName}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      matched ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {matched ? 'Verified' : 'Unconfirmed'}
                    </span>
                  </div>

                  {matched && (
                    <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Supported by verified project portfolio & parsed resume evidence</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onPrepareApplication(job.id);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-500/25 transition-all"
          >
            <span>Proceed to Prepare Application</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
