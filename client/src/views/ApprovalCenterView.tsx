import React, { useState } from 'react';
import { ApplicationItem } from '../types';
import {
  CheckCircle2,
  FileText,
  Building,
  ShieldCheck,
  Send,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

interface ApprovalCenterViewProps {
  applications: ApplicationItem[];
  onApprove: (appId: string) => Promise<void>;
}

export const ApprovalCenterView: React.FC<ApprovalCenterViewProps> = ({
  applications,
  onApprove,
}) => {
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const pendingApprovals = applications.filter(a => a.status === 'AWAITING_APPROVAL');

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await onApprove(id);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Approval Center
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-medium">
              {pendingApprovals.length} Pending Review
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Default policy: Applications require candidate review before automated transmission to employer ATS systems.
          </p>
        </div>
      </div>

      {pendingApprovals.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-2xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Applications Awaiting Approval</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            All prepared applications have either been reviewed or are pending requirement verification.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingApprovals.map(app => {
            const isApproving = approvingId === app.id;

            return (
              <div
                key={app.id}
                className="glass-panel p-6 rounded-2xl border border-brand-500/30 space-y-5 shadow-2xl"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg">
                        <Building className="w-3.5 h-3.5 text-brand-400" />
                        {app.company}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {app.location}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1.5">{app.jobTitle}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                      Match: {app.matchScore}%
                    </span>
                  </div>
                </div>

                {/* Prepared Screening Answers */}
                {Object.keys(app.preparedAnswers || {}).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Prepared Screening Answers
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(app.preparedAnswers).map(([k, ans]) => (
                        <div key={k} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                          <span className="font-mono text-[11px] text-brand-400 block mb-0.5">{k}</span>
                          <span className="text-slate-200">{ans}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grounded Cover Letter Preview */}
                {app.coverLetterText && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-brand-400" />
                      Grounded Cover Letter Draft (Strictly from verified FalkorDB facts)
                    </span>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {app.coverLetterText}
                    </div>
                  </div>
                )}

                {/* Bottom Decision Bar */}
                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Submission will be executed via permitted API / Playwright adapter with unique idempotency tracking.</span>
                  </div>

                  <button
                    onClick={() => handleApprove(app.id)}
                    disabled={isApproving}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isApproving ? 'Submitting Application...' : 'Approve & Submit Application'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
