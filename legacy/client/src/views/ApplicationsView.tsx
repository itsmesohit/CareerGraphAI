import React from 'react';
import { ApplicationItem } from '../types';
import {
  Layers,
  HelpCircle,
  CheckCircle2,
  Clock,
  Send,
  ExternalLink,
  ShieldCheck,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface ApplicationsViewProps {
  applications: ApplicationItem[];
  onNavigateToMissingInfo: () => void;
  onNavigateToApprovals: () => void;
  onApproveApplication: (appId: string) => void;
}

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  RECEIVED: { label: 'Received', color: 'bg-slate-800 text-slate-300', icon: Clock },
  JOB_VALIDATED: { label: 'Validated', color: 'bg-blue-950 text-blue-300 border-blue-500/30', icon: Clock },
  PROFILE_MATCHED: { label: 'Profile Matched', color: 'bg-cyan-950 text-cyan-300 border-cyan-500/30', icon: Clock },
  APPLICATION_PREPARED: { label: 'Prepared', color: 'bg-indigo-950 text-indigo-300 border-indigo-500/30', icon: Clock },
  WAITING_FOR_USER: { label: 'Missing Info (Paused)', color: 'bg-amber-950 text-amber-300 border-amber-500/40 animate-pulse', icon: HelpCircle },
  AWAITING_APPROVAL: { label: 'Awaiting Your Approval', color: 'bg-brand-950 text-brand-300 border-brand-500/40', icon: AlertTriangle },
  READY_TO_SUBMIT: { label: 'Ready to Submit', color: 'bg-purple-950 text-purple-300 border-purple-500/30', icon: Send },
  SUBMITTING: { label: 'Submitting...', color: 'bg-indigo-950 text-indigo-300 border-indigo-500/30', icon: Clock },
  SUBMITTED: { label: 'Submitted & Verified', color: 'bg-emerald-950 text-emerald-300 border-emerald-500/40', icon: CheckCircle2 },
};

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({
  applications,
  onNavigateToMissingInfo,
  onNavigateToApprovals,
  onApproveApplication,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Application Pipeline
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-medium">
              {applications.length} Active Tracks
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Persistent state machine powered by BullMQ workflows and FalkorDB context persistence.
          </p>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-2xl">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No active applications yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Discover jobs in the feed and click "Prepare Application" to initiate an automated agent workflow.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {applications.map(app => {
            const badge = STATUS_BADGES[app.status] || {
              label: app.status,
              color: 'bg-slate-800 text-slate-300',
              icon: Clock,
            };
            const Icon = badge.icon;

            return (
              <div
                key={app.id}
                className="glass-card p-5 rounded-2xl border border-slate-800/80 transition-all hover:border-slate-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${badge.color}`}>
                        <Icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{app.company}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400">{app.location}</span>
                    </div>

                    <h3 className="text-base font-bold text-white">{app.jobTitle}</h3>

                    {app.decisionExplanation && (
                      <p className="text-xs text-slate-400 line-clamp-1 italic">
                        "{app.decisionExplanation}"
                      </p>
                    )}

                    {app.submissionConfirmationId && (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono mt-2 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/30 w-fit">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Confirmation ID: {app.submissionConfirmationId}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-3">
                    {app.status === 'WAITING_FOR_USER' && (
                      <button
                        onClick={onNavigateToMissingInfo}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/25 transition-all"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Resolve Missing Info</span>
                      </button>
                    )}

                    {app.status === 'AWAITING_APPROVAL' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={onNavigateToApprovals}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                        >
                          Review Draft
                        </button>
                        <button
                          onClick={() => onApproveApplication(app.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Submit</span>
                        </button>
                      </div>
                    )}

                    {app.status === 'SUBMITTED' && (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4" />
                        Verified Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Cover letter expandable peek */}
                {app.coverLetterText && (
                  <details className="mt-4 pt-3 border-t border-slate-800/80 group">
                    <summary className="text-xs font-semibold text-brand-400 cursor-pointer hover:text-brand-300 flex items-center gap-1.5 select-none">
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Grounded Cover Letter Draft</span>
                    </summary>
                    <div className="mt-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                      {app.coverLetterText}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
