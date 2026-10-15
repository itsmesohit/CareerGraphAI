import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileCheck2,
  FileText,
  HelpCircle,
  Copy,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  Sparkles,
  Layers,
  Edit3,
  Save,
  Send,
  Info,
} from 'lucide-react';
import { api } from '../api/client.js';
import type { ApplicationDetailDTO } from '@careergraph/shared';

export const ApprovalsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingCoverLetterId, setEditingCoverLetterId] = useState<string | null>(null);
  const [editedCoverLetters, setEditedCoverLetters] = useState<Record<string, string>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch pending approvals
  const { data: approvalsData, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => api.getPendingApprovals(),
  });

  // Mutation: Approve Single Application
  const approveMutation = useMutation({
    mutationFn: ({
      id,
      contentHash,
      coverLetterText,
    }: {
      id: string;
      contentHash: string;
      coverLetterText?: string;
    }) =>
      api.approveApplication(id, {
        contentHash,
        coverLetterText,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      showToast(
        `Application approved & submitted! Confirmation ID: ${data.application.submissionConfirmationId || 'SUBMITTED'}`
      );
    },
    onError: (err: any) => {
      showToast(err.message || 'Approval failed');
    },
  });

  // Mutation: Bulk Approve All
  const bulkApproveMutation = useMutation({
    mutationFn: (approvals: Array<{ applicationId: string; contentHash: string }>) =>
      api.bulkApproveApplications(approvals),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      showToast(`Bulk approved ${data.approvedCount} application(s) successfully!`);
    },
    onError: (err: any) => {
      showToast(err.message || 'Bulk approval failed');
    },
  });

  // Mutation: Reject Draft
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.rejectApplicationApproval(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      showToast('Application draft rejected.');
    },
    onError: (err: any) => {
      showToast(err.message || 'Rejection failed');
    },
  });

  const approvals = approvalsData?.approvals || [];

  const handleCopyPacket = async (app: ApplicationDetailDTO) => {
    try {
      const res = await api.getApplicationPacket(app.id);
      const p = res.packet;
      const text = `================================================
APPLICATION PACKET: ${p.company} - ${p.jobTitle}
Direct Link: ${p.applyUrl}
SHA-256 Verified Hash: ${p.contentHash}
Generated At: ${new Date(p.generatedAt).toLocaleString()}
================================================

[TAILORED RESUME BULLETS]
${p.tailoredBullets.map((b) => `• ${b}`).join('\n')}

[COVER LETTER]
${p.coverLetterText}

[SCREENING QUESTIONS & VERIFIED ANSWERS]
${p.preparedAnswers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}
================================================`;

      await navigator.clipboard.writeText(text);
      showToast('Application packet copied to clipboard!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate packet');
    }
  };

  return (
    <div className="min-h-screen bg-dark-primary pb-20">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-grid-dark opacity-30 pointer-events-none" />
      {/* Gradient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-accent-violet/20 via-accent-magenta/10 to-transparent blur-3xl pointer-events-none -z-10" />
      
      <div className="relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-dark-elevated/95 border border-accent-cyan/40 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-accent-cyan" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-dark-border bg-gradient-to-b from-dark-secondary/80 via-dark-primary to-dark-primary px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-accent-violet mb-2">
              <Lock className="w-4 h-4" />
              <span>Mandatory Candidate Approval Gate (Spec §14)</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Approval Center
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Every tailored resume, cover letter, and answer packet is cryptographically hashed with SHA-256. External submissions cannot occur without candidate verification.
            </p>
          </div>

          {/* Bulk Approve Action */}
          {approvals.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const items = approvals
                    .filter((a) => Boolean(a.contentHash))
                    .map((a) => ({
                      applicationId: a.id,
                      contentHash: a.contentHash!,
                    }));
                  if (items.length > 0) {
                    bulkApproveMutation.mutate(items);
                  }
                }}
                disabled={bulkApproveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {bulkApproveMutation.isPending
                    ? 'Signing...'
                    : `Bulk Approve All (${approvals.length})`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-amber-200">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-500">
              Content-Hash Integrity Protection
            </span>
            <p className="text-amber-200/80 leading-relaxed">
              Before submission, the system validates that the candidate's approved payload matches the exact SHA-256 hash computed during agent orchestration. If any agent or third party alters the content, the submission is rejected immediately.
            </p>
          </div>
        </div>

        {/* Approvals List */}
        <div className="mt-8 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono uppercase tracking-widest">
                Scanning pending approval queue...
              </span>
            </div>
          ) : approvals.length === 0 ? (
            <div className="py-20 text-center bg-slate-100 border border-slate-100 rounded-2xl p-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">All applications approved!</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                No job applications are currently awaiting candidate sign-off. When new applications are prepared, they will appear here for your cryptographic verification.
              </p>
              <Link
                to="/applications"
                className="inline-block mt-4 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 transition-colors"
              >
                Go to Applications Tracker
              </Link>
            </div>
          ) : (
            approvals.map((app) => {
              const isEditing = editingCoverLetterId === app.id;
              const currentCoverLetter =
                editedCoverLetters[app.id] ?? (app.coverLetterText || '');

              return (
                <div
                  key={app.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl transition-all space-y-6"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-extrabold text-lg text-slate-900">{app.company}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 border border-sky-500/30">
                          {app.matchScore}% Match Fit
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          Mode: {app.mode}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">{app.jobTitle}</h3>
                      <div className="text-xs text-slate-500 mt-1">
                        {app.location || (app.remoteType === 'REMOTE' ? 'Remote' : 'Location not specified')}
                      </div>
                    </div>

                    {/* SHA-256 Verification Pill */}
                    <div className="flex flex-col sm:items-end gap-1">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-mono font-medium">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="truncate max-w-[200px]" title={app.contentHash || ''}>
                          SHA-256: {app.contentHash ? `${app.contentHash.slice(0, 12)}...` : 'N/A'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Ready for candidate cryptographic sign-off
                      </span>
                    </div>
                  </div>

                  {/* Body: Tailored Content Preview */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Grounded Resume Bullets */}
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-sky-600" /> Grounded Tailored Bullets
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500">
                            ResumeTailoringAgent
                          </span>
                        </div>
                        {app.tailoredResumeJson?.tailoredBullets &&
                        app.tailoredResumeJson.tailoredBullets.length > 0 ? (
                          <ul className="space-y-2.5">
                            {app.tailoredResumeJson.tailoredBullets.map((b: string, i: number) => (
                              <li
                                key={i}
                                className="text-xs text-slate-800 flex items-start gap-2 bg-slate-100 p-2.5 rounded-lg border border-slate-100"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">{b}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs text-slate-500 py-4">No tailored bullets generated.</div>
                        )}
                      </div>

                      {/* Matched Skills */}
                      {app.tailoredResumeJson?.skills && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1.5">
                            Demonstrated Skills
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {app.tailoredResumeJson.skills.map((s: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] border border-slate-100"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Cover Letter */}
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FileCheck2 className="w-3.5 h-3.5 text-indigo-600" /> Tailored Cover Letter
                          </h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingCoverLetterId(null);
                                } else {
                                  setEditingCoverLetterId(app.id);
                                }
                              }}
                              className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{isEditing ? 'Cancel Edit' : 'Edit Draft'}</span>
                            </button>
                            <button
                              onClick={async () => {
                                await navigator.clipboard.writeText(currentCoverLetter);
                                showToast('Cover letter copied!');
                              }}
                              className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <textarea
                            rows={10}
                            value={currentCoverLetter}
                            onChange={(e) =>
                              setEditedCoverLetters((prev) => ({
                                ...prev,
                                [app.id]: e.target.value,
                              }))
                            }
                            className="w-full p-3 rounded-lg bg-slate-100 border border-sky-500/50 text-xs text-slate-900 leading-relaxed focus:outline-none"
                          />
                        ) : (
                          <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-100 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-[280px] overflow-y-auto">
                            {currentCoverLetter || 'No cover letter drafted.'}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 text-[10px] text-slate-500 italic">
                        {isEditing
                          ? 'Edits will be verified and re-hashed upon approval.'
                          : 'Generated strictly from verified experiences and matched skills.'}
                      </div>
                    </div>
                  </div>

                  {/* Form Questions & Answers (if any) */}
                  {app.preparedAnswers && Object.keys(app.preparedAnswers).length > 0 && (
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-sky-600" /> Screening Question Answers
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.values(app.preparedAnswers).map((qa: any, i: number) => (
                          <div
                            key={i}
                            className="bg-slate-100 p-3 rounded-lg border border-slate-100 space-y-1 text-xs"
                          >
                            <div className="font-semibold text-slate-800">{qa.question}</div>
                            <div className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                              {qa.answer}
                            </div>
                            <div className="text-[10px] font-mono text-emerald-600">
                              Verified Source: {qa.source}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Action Bar */}
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                      onClick={() => handleCopyPacket(app)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Manual Packet</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => rejectMutation.mutate({ id: app.id, reason: 'Rejected by candidate' })}
                        disabled={rejectMutation.isPending}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-semibold border border-rose-500/20 transition-colors"
                      >
                        Reject Draft
                      </button>

                      <button
                        onClick={() => {
                          if (app.contentHash) {
                            approveMutation.mutate({
                              id: app.id,
                              contentHash: app.contentHash,
                              coverLetterText: isEditing ? currentCoverLetter : undefined,
                            });
                          }
                        }}
                        disabled={approveMutation.isPending || !app.contentHash}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] disabled:opacity-50"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{approveMutation.isPending ? 'Verifying & Submitting...' : 'Approve & Submit'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
    </div>
  );
};
