import React, { useState } from 'react';
import { RecruiterDraft } from '../types';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Building,
  User,
  ShieldCheck,
  Edit3,
} from 'lucide-react';

interface OutreachViewProps {
  drafts: RecruiterDraft[];
  onCreateDraft: (params: {
    company: string;
    jobTitle: string;
    recipientName: string;
    recipientEmail: string;
  }) => Promise<void>;
  onApproveDraft: (draftId: string) => Promise<void>;
  onSendDraft: (draftId: string) => Promise<void>;
}

export const OutreachView: React.FC<OutreachViewProps> = ({
  drafts,
  onCreateDraft,
  onApproveDraft,
  onSendDraft,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !jobTitle || !recipientEmail) return;

    setIsCreating(true);
    try {
      await onCreateDraft({ company, jobTitle, recipientName, recipientEmail });
      setCompany('');
      setJobTitle('');
      setRecipientName('');
      setRecipientEmail('');
      setShowCreate(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await onApproveDraft(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSend = async (id: string) => {
    setActionLoadingId(id);
    try {
      await onSendDraft(id);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Recruiter Outreach Workspace
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-medium">
              {drafts.length} Messages
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Personalized outreach drafts grounded in FalkorDB career achievements. Strict approval locking prevents unauthorized sends.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 transition-all self-start sm:self-auto"
        >
          <Mail className="w-4 h-4" />
          <span>New Recruiter Outreach</span>
        </button>
      </div>

      {/* Create Modal / Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="glass-panel p-6 rounded-2xl border border-brand-500/40 space-y-4 animate-in slide-in-from-top-4 duration-200">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            Generate Targeted Outreach Draft
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Company Name</label>
              <input
                type="text"
                required
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. FalkorDB / Anthropic"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Target Job Title</label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Senior AI Systems Engineer"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Recipient Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                placeholder="e.g. Sarah Connor (Hiring Lead)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Recipient Email</label>
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="e.g. sarah.connor@example.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs"
            >
              {isCreating ? 'Generating from Graph Facts...' : 'Generate Fact-Grounded Draft'}
            </button>
          </div>
        </form>
      )}

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-2xl">
          <Mail className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Recruiter Outreach Drafts</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Click "New Recruiter Outreach" or open any job card to generate a personalized recruiter message.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map(draft => {
            const isLoading = actionLoadingId === draft.id;

            return (
              <div
                key={draft.id}
                className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg">
                      <Building className="w-3.5 h-3.5 text-brand-400" />
                      {draft.company}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      To: {draft.recipientName} ({draft.recipientEmail})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {draft.sent ? (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Dispatched via Gmail / MS Graph
                      </span>
                    ) : draft.approved ? (
                      <span className="text-xs font-bold text-brand-400 bg-brand-950/40 px-3 py-1 rounded-full border border-brand-500/30 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Candidate Approved
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-400 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Approval Required
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-1">
                    <span className="text-slate-500 font-mono">Subject: </span>
                    {draft.subject}
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                    {draft.body}
                  </div>
                </div>

                {/* Bottom Safety & Dispatch Bar */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
                    <span>Safety Policy: Drafts can only be sent once explicitly approved by the candidate.</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!draft.sent && !draft.approved && (
                      <button
                        onClick={() => handleApprove(draft.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-all"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Approve Content</span>
                      </button>
                    )}

                    {!draft.sent && draft.approved && (
                      <button
                        onClick={() => handleSend(draft.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all hover:scale-105"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to Recruiter Now</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
