import React, { useState } from 'react';
import { MissingInfoItem } from '../types';
import {
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Database,
  Building,
} from 'lucide-react';

interface MissingInfoInboxViewProps {
  missingItems: MissingInfoItem[];
  onAnswerItem: (itemId: string, answer: string) => Promise<void>;
}

export const MissingInfoInboxView: React.FC<MissingInfoInboxViewProps> = ({
  missingItems,
  onAnswerItem,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleAnswerChange = (id: string, text: string) => {
    setAnswers(prev => ({ ...prev, [id]: text }));
  };

  const handleSubmit = async (item: MissingInfoItem) => {
    const text = answers[item.id] || item.suggestedAnswer || '';
    if (!text.trim()) return;

    setSubmittingId(item.id);
    try {
      await onAnswerItem(item.id, text);
      setAnswers(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Missing-Information Inbox
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
              {missingItems.length} Pending Prompts
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            The agent pauses when a required job constraint lacks verified graph evidence. Your response persists to FalkorDB and resumes the workflow.
          </p>
        </div>
      </div>

      {missingItems.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-2xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">All Application Requirements Satisfied</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Your career graph currently has verified evidence for all active application workflows. No agent pauses are pending.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {missingItems.map(item => {
            const currentAnswer = answers[item.id] !== undefined ? answers[item.id] : (item.suggestedAnswer || '');
            const isSubmitting = submittingId === item.id;

            return (
              <div
                key={item.id}
                className="glass-panel p-6 rounded-2xl border-l-4 border-l-amber-500 space-y-4 shadow-xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg">
                      <Building className="w-3.5 h-3.5 text-amber-400" />
                      {item.company}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{item.jobTitle}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Awaiting Candidate Verification
                  </span>
                </div>

                {/* Question and Reason */}
                <div>
                  <h4 className="text-sm font-bold text-white mb-1.5 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{item.questionText}</span>
                  </h4>
                  <div className="text-xs text-amber-200/80 bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/20 flex items-start gap-2 mt-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Reason:</strong> {item.reason}</span>
                  </div>
                </div>

                {/* Input Area */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Your Verified Response (Will be persisted to FalkorDB for future reuse)
                  </label>
                  <textarea
                    rows={3}
                    value={currentAnswer}
                    onChange={e => handleAnswerChange(item.id, e.target.value)}
                    placeholder="Provide your verified answer or experience details..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 leading-relaxed"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Upserts to Semantic & Procedural Graph Memory</span>
                  </div>

                  <button
                    onClick={() => handleSubmit(item)}
                    disabled={isSubmitting || !currentAnswer.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-brand-500/25 transition-all"
                  >
                    <span>{isSubmitting ? 'Saving & Resuming...' : 'Save to FalkorDB & Resume Workflow'}</span>
                    <ArrowRight className="w-4 h-4" />
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
