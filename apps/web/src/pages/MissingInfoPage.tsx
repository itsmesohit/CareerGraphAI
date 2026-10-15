import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Shield,
  Building2,
  Briefcase,
  Save,
  Check,
  Globe,
  Lock,
  Layers,
  Info,
} from 'lucide-react';
import { api } from '../api/client.js';
import type { MissingInfoRequestDTO } from '@careergraph/shared';

export const MissingInfoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Local state for answers and scopes per question
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [scopes, setScopes] = useState<Record<string, 'GLOBAL' | 'PER_COMPANY' | 'ONE_TIME'>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch missing info items
  const { data: missingInfoData, isLoading } = useQuery({
    queryKey: ['missing-info'],
    queryFn: () => api.getMissingInfoItems(),
  });

  // Mutation: Resolve missing info item
  const resolveMutation = useMutation({
    mutationFn: ({
      id,
      candidateAnswer,
      answerScope,
    }: {
      id: string;
      candidateAnswer: string;
      answerScope: string;
    }) =>
      api.resolveMissingInfoItem(id, {
        candidateAnswer,
        answerScope,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['missing-info'] });
      queryClient.invalidateQueries({ queryKey: ['missing-info-count'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      showToast('Answer verified and saved! Application workflow unblocked.');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to save answer');
    },
  });

  const items = missingInfoData?.items || [];

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-100 border border-sky-500/40 text-sky-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-sky-600" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-white px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-sky-600 mb-2">
              <HelpCircle className="w-4 h-4" />
              <span>Interactive Missing-Information Inbox (Spec §13)</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Missing-Information Inbox
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              When applications encounter screening questions without verified answers, the orchestrator halts in <code className="text-sky-500">WAITING_FOR_USER</code>. Answers are stored in profile memory with scoped persistence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-mono">
              Pending Items: <strong className="text-slate-900">{items.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Memory Architecture Callout */}
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-sky-200 mb-6">
          <Sparkles className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sky-500">
              Scoped Profile Memory Retention
            </span>
            <p className="text-sky-200/80 leading-relaxed">
              Choose your answer scope: <strong>GLOBAL</strong> saves to your universal question bank for all future applications, <strong>PER_COMPANY</strong> applies only to this employer, and <strong>ONE_TIME</strong> is scoped solely to this submission.
            </p>
          </div>
        </div>

        {/* Questions List */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest">
              Loading unverified screening questions...
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center bg-slate-100 border border-slate-100 rounded-2xl p-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">Inbox is completely clear!</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              All screening questions for your active applications have verified answers. Your application pipelines are moving forward smoothly.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                to="/applications"
                className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors"
              >
                View Applications
              </Link>
              <Link
                to="/approvals"
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-colors shadow-lg shadow-sky-500/20"
              >
                Go to Approval Center
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((item) => {
              const currentAnswer = answers[item.id] ?? item.suggestedAnswer ?? '';
              const currentScope = scopes[item.id] ?? 'GLOBAL';

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5"
                >
                  {/* Item Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-sky-600" />
                        {item.companyName}
                      </span>
                      <span className="text-xs text-slate-500">• {item.jobTitle}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-100">
                        {item.category}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 self-start sm:self-auto">
                      Workflow: WAITING_FOR_USER
                    </span>
                  </div>

                  {/* Question Details */}
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-slate-900">{item.questionText}</h3>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 flex items-start gap-2">
                      <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-sky-500">Why this is needed:</strong> {item.reason}
                      </div>
                    </div>
                  </div>

                  {/* Answer Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-slate-800">
                        Your Verified Answer:
                      </label>
                      {item.suggestedAnswer && currentAnswer !== item.suggestedAnswer && (
                        <button
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [item.id]: item.suggestedAnswer || '',
                            }))
                          }
                          className="text-[11px] text-sky-600 hover:underline"
                        >
                          Use Suggested: "{item.suggestedAnswer}"
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={currentAnswer}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Type your answer clearly..."
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-200 text-slate-900 text-xs leading-relaxed focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Scope Selector & Submission Action */}
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Scope Selector */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">Memory Scope:</span>
                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            setScopes((prev) => ({ ...prev, [item.id]: 'GLOBAL' }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            currentScope === 'GLOBAL'
                              ? 'bg-sky-500/20 text-sky-500 border border-sky-500/30'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                          title="Save globally for all future job applications"
                        >
                          <Globe className="w-3 h-3 inline mr-1" />
                          Global
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setScopes((prev) => ({ ...prev, [item.id]: 'PER_COMPANY' }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            currentScope === 'PER_COMPANY'
                              ? 'bg-sky-500/20 text-sky-500 border border-sky-500/30'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                          title="Save only for this employer"
                        >
                          <Building2 className="w-3 h-3 inline mr-1" />
                          Company Only
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setScopes((prev) => ({ ...prev, [item.id]: 'ONE_TIME' }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                            currentScope === 'ONE_TIME'
                              ? 'bg-sky-500/20 text-sky-500 border border-sky-500/30'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                          title="Use only for this single application"
                        >
                          <Lock className="w-3 h-3 inline mr-1" />
                          One-Time
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={() => {
                        if (!currentAnswer.trim()) {
                          showToast('Please provide an answer before submitting');
                          return;
                        }
                        resolveMutation.mutate({
                          id: item.id,
                          candidateAnswer: currentAnswer,
                          answerScope: currentScope,
                        });
                      }}
                      disabled={resolveMutation.isPending || !currentAnswer.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {resolveMutation.isPending
                          ? 'Saving & Resuming...'
                          : 'Save & Resume Application'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
