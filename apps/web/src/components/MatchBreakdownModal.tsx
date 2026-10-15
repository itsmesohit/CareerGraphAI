import React from 'react';
import {
  X,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  Code,
  MapPin,
  DollarSign,
  ExternalLink,
  Network,
  Award,
} from 'lucide-react';
import type { MatchScoreResult } from '@careergraph/shared';

interface MatchBreakdownModalProps {
  match: MatchScoreResult | null;
  jobTitle?: string;
  jobCompany?: string;
  applyUrl?: string;
  onClose: () => void;
  onOpenGraph?: (jobId: string) => void;
}

export const MatchBreakdownModal: React.FC<MatchBreakdownModalProps> = ({
  match,
  jobTitle,
  jobCompany,
  applyUrl,
  onClose,
  onOpenGraph,
}) => {
  if (!match) return null;

  const getScoreColor = (score: number, isEliminated: boolean) => {
    if (isEliminated) return 'text-rose-600 bg-rose-500/10 border-rose-500/30';
    if (score >= 80) return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 65) return 'text-sky-600 bg-sky-500/10 border-sky-500/30';
    if (score >= 50) return 'text-amber-600 bg-amber-500/10 border-amber-500/30';
    return 'text-slate-500 bg-slate-100 border-slate-200';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 65) return 'bg-sky-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-100 border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-500">{jobCompany || 'Target Employer'}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getScoreColor(
                  match.overallScore,
                  match.isEliminated
                )}`}
              >
                {match.isEliminated ? '0% • DISQUALIFIED' : `${match.overallScore}% • ${match.recommendation}`}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {jobTitle || 'Role Match Evaluation'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Grounded, deterministic scoring function with multi-hop graph proof paths.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Disqualification Alert Banner */}
          {match.isEliminated && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-600 text-sm">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Mandatory Constraint Disqualification</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-slate-700">
                {match.disqualifiers.map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Concise Grounded Explanation */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-600 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Explainable AI Match Assessment</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">{match.conciseExplanation}</p>
            <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Recommended Next Action:</span>
              <span>{match.recommendedAction}</span>
            </div>
          </div>

          {/* Factor Breakdown Bars */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Weighted Factor Breakdown (Spec §10)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Required Skills Fit', score: match.breakdown.requiredSkillsScore, weight: '35%' },
                { label: 'Preferred Skills Fit', score: match.breakdown.preferredSkillsScore, weight: '15%' },
                { label: 'Seniority & Experience', score: match.breakdown.seniorityScore, weight: '15%' },
                { label: 'Role Title Fit', score: match.breakdown.titleScore, weight: '15%' },
                { label: 'Workplace & Remote Fit', score: match.breakdown.locationScore, weight: '10%' },
                { label: 'Compensation Alignment', score: match.breakdown.compensationScore, weight: '10%' },
              ].map((factor, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{factor.label}</span>
                    <span className="font-mono text-slate-900 font-bold">{factor.score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(
                        factor.score
                      )}`}
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono text-right">
                    Weight: {factor.weight}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Matched Skills & Evidence Paths */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Matched Skills & Evidence Paths ({match.matchedSkills.length})
            </h3>
            <div className="space-y-2.5">
              {match.matchedSkills.map((ms, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{ms.skill}</span>
                      {ms.isVerified && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3" />
                          VERIFIED
                        </span>
                      )}
                      {ms.candidateProficiency && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-500">
                          {ms.candidateProficiency}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {ms.isRequired ? 'Mandatory' : 'Preferred'} ({ms.weight}x)
                    </span>
                  </div>

                  {/* Evidence Demonstrations */}
                  {ms.demonstrations && ms.demonstrations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                      {ms.demonstrations.map((demo, dIdx) => (
                        <div
                          key={dIdx}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-950/50 border border-sky-500/20 text-sky-500 text-[11px]"
                        >
                          {demo.type === 'PROJECT' ? (
                            <Code className="w-3 h-3 text-cyan-400" />
                          ) : (
                            <Briefcase className="w-3 h-3 text-emerald-600" />
                          )}
                          <span>{demo.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Missing Requirements */}
          {match.missingRequirements && match.missingRequirements.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Missing Requirements & Gaps ({match.missingRequirements.length})
              </h3>
              <div className="space-y-2">
                {match.missingRequirements.map((req, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-700 font-medium">{req.description}</span>
                    <span className="font-mono text-slate-500 text-[10px]">
                      {req.category} • {req.weight}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supporting Experiences & Projects */}
          {(match.supportingExperiences.length > 0 || match.supportingProjects.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {match.supportingExperiences.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Supporting Work Experience
                  </h4>
                  <div className="space-y-2">
                    {match.supportingExperiences.map((exp) => (
                      <div
                        key={exp.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1"
                      >
                        <div className="font-semibold text-slate-900">{exp.title}</div>
                        <div className="text-slate-500">{exp.company}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {exp.matchedSkills.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {match.supportingProjects.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Supporting Projects
                  </h4>
                  <div className="space-y-2">
                    {match.supportingProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1"
                      >
                        <div className="font-semibold text-slate-900">{proj.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {proj.matchedSkills.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Calculated: {new Date(match.calculatedAt).toLocaleTimeString()}
          </div>

          <div className="flex items-center gap-2">
            {onOpenGraph && (
              <button
                onClick={() => onOpenGraph(match.jobId)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 text-slate-900 text-xs font-semibold border border-slate-200 transition-colors"
              >
                <Network className="w-3.5 h-3.5 text-sky-600" />
                <span>Inspect Graph Path</span>
              </button>
            )}

            {applyUrl && (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all"
              >
                <span>Proceed to Apply</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
