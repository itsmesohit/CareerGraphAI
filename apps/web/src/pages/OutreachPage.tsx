import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import {
  Mail,
  Send,
  Calendar,
  Shield,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Plus,
  AlertTriangle,
  Lock,
  Download,
  Trash2,
  Inbox,
  Check,
  Building,
  User,
  HelpCircle,
  Video,
} from 'lucide-react';

export const OutreachPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'outreach' | 'inbound' | 'interviews' | 'integrations'>('outreach');

  // Modals & form state
  const [composeOpen, setComposeOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [simInboundOpen, setSimInboundOpen] = useState(false);

  // New outreach draft form
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [newContext, setNewContext] = useState('');

  // Selected draft for viewing/editing
  const [selectedDraft, setSelectedDraft] = useState<any | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  // New interview form
  const [intAppId, setIntAppId] = useState('');
  const [intRoundName, setIntRoundName] = useState('Technical Screening');
  const [intRoundType, setIntRoundType] = useState('Technical');
  const [intScheduledAt, setIntScheduledAt] = useState('');
  const [intDuration, setIntDuration] = useState(45);
  const [intMeetingLink, setIntMeetingLink] = useState('');
  const [intInterviewers, setIntInterviewers] = useState('');

  // Inbound simulation form
  const [simSubject, setSimSubject] = useState('Invitation to interview: Staff Engineer');
  const [simSnippet, setSimSnippet] = useState('We would love to invite you for a 45-minute technical screening.');
  const [simSender, setSimSender] = useState('recruiting@stripe.com');

  // Queries
  const { data: quotaData } = useQuery({
    queryKey: ['outreach-quota'],
    queryFn: () => api.getOutreachQuota(),
  });

  const { data: outreachData, isLoading: outreachLoading } = useQuery({
    queryKey: ['outreach-list'],
    queryFn: () => api.getOutreachList(),
  });

  const { data: inboundData, isLoading: inboundLoading } = useQuery({
    queryKey: ['inbound-emails'],
    queryFn: () => api.getInboundEmails(),
  });

  const { data: interviewsData, isLoading: interviewsLoading } = useQuery({
    queryKey: ['interviews-list'],
    queryFn: () => api.getInterviews(),
  });

  const { data: integrationsData, isLoading: integrationsLoading } = useQuery({
    queryKey: ['integrations-list'],
    queryFn: () => api.getIntegrations(),
  });

  const { data: applicationsData } = useQuery({
    queryKey: ['applications-brief'],
    queryFn: () => api.getApplications(),
  });

  // Mutations
  const createDraftMutation = useMutation({
    mutationFn: (data: any) => api.createOutreachDraft(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-list'] });
      setComposeOpen(false);
      setNewCompany('');
      setNewRole('');
      setNewRecipientName('');
      setNewRecipientEmail('');
      setNewContext('');
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateOutreachDraft(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-list'] });
      setSelectedDraft(res.draft);
    },
  });

  const approveDraftMutation = useMutation({
    mutationFn: ({ id, hash }: { id: string; hash: string }) => api.approveOutreachDraft(id, hash),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-list'] });
      setSelectedDraft(res.draft);
    },
  });

  const sendDraftMutation = useMutation({
    mutationFn: ({ id, hash }: { id: string; hash: string }) => api.sendOutreachDraft(id, hash),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-list'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-quota'] });
      setSelectedDraft(res.draft);
    },
  });

  const scheduleInterviewMutation = useMutation({
    mutationFn: (data: any) => api.scheduleInterview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews-list'] });
      setScheduleOpen(false);
    },
  });

  const classifyMutation = useMutation({
    mutationFn: (data: any) => api.classifyInboundEmail(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-emails'] });
      setSimInboundOpen(false);
    },
  });

  const resolveInboundMutation = useMutation({
    mutationFn: ({ id, apply }: { id: string; apply: boolean }) =>
      api.resolveInboundEmail(id, { applySuggestedStatus: apply }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-emails'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.disconnectIntegration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-list'] });
    },
  });

  const quota = quotaData?.quota || { sentToday: 0, dailyLimit: 25, remaining: 25 };
  const drafts = outreachData?.outreach || [];
  const inboundEmails = inboundData?.events || [];
  const interviews = interviewsData?.interviews || [];
  const integrations = integrationsData?.integrations || [];
  const applications = applicationsData?.applications || [];

  return (
    <div className="min-h-screen bg-white text-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Quota Gauge */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-100 border border-slate-100 p-6 rounded-2xl backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  Outreach & Mailbox Copilot
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20 font-medium">
                    Phase 8
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct recruiter engagement, inbound status classifier, and .ics calendar sync
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Daily Send Quota Meter */}
            <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-3 w-full md:w-auto">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Daily Outreach Quota</div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{quota.remaining}</span>
                  <span className="text-xs text-slate-500 font-normal">/ {quota.dailyLimit} remaining</span>
                </div>
              </div>
              <div className="w-16 bg-slate-100 rounded-full h-1.5 ml-2 overflow-hidden">
                <div
                  className="bg-sky-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${(quota.sentToday / quota.dailyLimit) * 100}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setComposeOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Compose Recruiter Email
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab('outreach')}
            className={`pb-3 px-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'outreach'
                ? 'border-sky-400 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-4 h-4" />
            Recruiter Outreach ({drafts.length})
          </button>
          <button
            onClick={() => setActiveTab('inbound')}
            className={`pb-3 px-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'inbound'
                ? 'border-sky-400 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Inbound Classifier ({inboundEmails.length})
          </button>
          <button
            onClick={() => setActiveTab('interviews')}
            className={`pb-3 px-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'interviews'
                ? 'border-sky-400 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Interviews & Prep ({interviews.length})
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`pb-3 px-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'integrations'
                ? 'border-sky-400 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            Integrations ({integrations.length})
          </button>
        </div>

        {/* TAB 1: Recruiter Outreach Drafts */}
        {activeTab === 'outreach' && (
          <div className="space-y-4">
            {outreachLoading ? (
              <div className="p-12 text-center text-slate-500">Loading outreach drafts...</div>
            ) : drafts.length === 0 ? (
              <div className="p-12 text-center bg-slate-100 rounded-2xl border border-slate-100 space-y-3">
                <Mail className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">No Recruiter Outreach Drafts Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Compose your first hyper-personalized outreach email grounded in your verified career graph achievements.
                </p>
                <button
                  onClick={() => setComposeOpen(true)}
                  className="px-4 py-2 bg-sky-500/20 text-sky-600 border border-sky-500/30 rounded-xl text-xs font-semibold hover:bg-sky-500/30 transition-all"
                >
                  Create Outreach Draft
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drafts.map((d: any) => (
                  <div
                    key={d.id}
                    className="p-5 bg-slate-100 border border-slate-100 hover:border-sky-500/30 rounded-2xl transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-sky-600">{d.company}</div>
                          <div className="text-sm font-semibold text-slate-900 line-clamp-1">{d.jobTitle}</div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            d.status === 'SENT'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                              : d.status === 'APPROVED'
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{d.recipientName}</span>
                        <span className="text-slate-500">&lt;{d.recipientEmail}&gt;</span>
                      </div>

                      <div className="text-xs text-slate-700 font-medium line-clamp-1">
                        Subj: {d.subject}
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                        {d.bodyText}
                      </p>

                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                        <Lock className="w-3 h-3 text-slate-500" />
                        <span>Hash: {d.contentHash.substring(0, 14)}...</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedDraft(d);
                          setEditSubject(d.subject);
                          setEditBody(d.bodyText);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-700 text-xs font-medium text-slate-800 transition-all"
                      >
                        Inspect / Edit
                      </button>

                      {d.status === 'DRAFT' && (
                        <button
                          onClick={() => approveDraftMutation.mutate({ id: d.id, hash: d.contentHash })}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-semibold border border-amber-500/30 transition-all flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" />
                          Approve
                        </button>
                      )}

                      {d.status === 'APPROVED' && (
                        <button
                          onClick={() => sendDraftMutation.mutate({ id: d.id, hash: d.contentHash })}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 text-xs font-semibold border border-emerald-500/30 transition-all flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          Send Now
                        </button>
                      )}

                      {d.status === 'SENT' && (
                        <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Dispatched
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Inbound Email Classifier */}
        {activeTab === 'inbound' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                CareerGraph AI automatically scans, correlates, and classifies employer responses.
              </p>
              <button
                onClick={() => setSimInboundOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-700 text-xs font-semibold text-slate-700 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                Simulate Recruiter Email
              </button>
            </div>

            {inboundLoading ? (
              <div className="p-12 text-center text-slate-500">Loading inbound communications...</div>
            ) : inboundEmails.length === 0 ? (
              <div className="p-12 text-center bg-slate-100 rounded-2xl border border-slate-100 space-y-3">
                <Inbox className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">No Inbound Emails Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When employers reply to your applications or outreach, CareerGraph will automatically classify them and suggest status updates.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {inboundEmails.map((e: any) => (
                  <div
                    key={e.id}
                    className="p-5 bg-slate-100 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            e.classifiedCategory === 'OFFER_RECEIVED'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                              : e.classifiedCategory === 'INTERVIEW_INVITATION'
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                              : e.classifiedCategory === 'APPLICATION_ACKNOWLEDGED'
                              ? 'bg-sky-500/15 text-sky-600 border border-sky-500/20'
                              : e.classifiedCategory === 'REJECTION'
                              ? 'bg-rose-500/15 text-rose-600 border border-rose-500/20'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {e.classifiedCategory.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Confidence: {Math.round(e.confidence * 100)}%
                        </span>
                        {e.company && (
                          <span className="text-xs font-semibold text-sky-600 flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {e.company}
                          </span>
                        )}
                        {e.autoApplied && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-medium">
                            Auto-Applied
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-slate-900">{e.subject}</div>
                      <div className="text-xs text-slate-500 font-mono">From: {e.senderEmail}</div>
                      <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                        {e.snippet}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                      {e.suggestedStatus && !e.isResolved && !e.autoApplied && (
                        <button
                          onClick={() => resolveInboundMutation.mutate({ id: e.id, apply: true })}
                          className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-600 border border-sky-500/30 text-xs font-semibold transition-all whitespace-nowrap"
                        >
                          Update Status to {e.suggestedStatus}
                        </button>
                      )}
                      {e.isResolved && (
                        <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Resolved ({e.actionTaken})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Interviews & Calendar Sync */}
        {activeTab === 'interviews' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Scheduled interview rounds with auto-generated preparation questions and .ics calendar sync.
              </p>
              <button
                onClick={() => setScheduleOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule Interview Round
              </button>
            </div>

            {interviewsLoading ? (
              <div className="p-12 text-center text-slate-500">Loading interview schedule...</div>
            ) : interviews.length === 0 ? (
              <div className="p-12 text-center bg-slate-100 rounded-2xl border border-slate-100 space-y-3">
                <Calendar className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="text-base font-semibold text-slate-900">No Interviews Scheduled Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When you schedule an interview round, CareerGraph will automatically prepare targeted questions and provide a standard .ics calendar invite.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {interviews.map((int: any) => (
                  <div
                    key={int.id}
                    className="p-6 bg-slate-100 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all space-y-4"
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
                            {int.company} — {int.jobTitle}
                          </span>
                          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                            {int.roundType}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{int.roundName}</h3>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(int.scheduledAt).toLocaleString()} ({int.durationMinutes} mins)
                          </span>
                          {int.meetingLink && (
                            <a
                              href={int.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-600 hover:underline flex items-center gap-1"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Meeting Link
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/v1/interviews/${int.id}/ics`}
                          download
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 text-xs font-semibold text-slate-800 border border-slate-200 transition-all flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-sky-600" />
                          Download .ics
                        </a>
                      </div>
                    </div>

                    {/* Prep Questions Accordion */}
                    {int.prepQuestions && int.prepQuestions.length > 0 && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          Tailored Preparation Questions
                        </div>
                        <div className="space-y-3">
                          {int.prepQuestions.map((q: any, qIdx: number) => (
                            <div key={qIdx} className="space-y-1.5 border-l-2 border-indigo-500/40 pl-3">
                              <div className="text-xs font-semibold text-slate-800">{q.question}</div>
                              {q.suggestedPoints && (
                                <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-0.5">
                                  {q.suggestedPoints.map((pt: string, ptIdx: number) => (
                                    <li key={ptIdx}>{pt}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Connected Integrations */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div className="p-5 bg-slate-100 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Shield className="w-4 h-4 text-emerald-600" />
                Spec §16 Envelope Encryption Notice
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                CareerGraph AI never asks for or stores your mailbox passwords. All OAuth access and refresh tokens are encrypted at rest using AES-256-GCM envelope encryption with a per-credential Data Encryption Key (DEK). Disconnecting any integration permanently purges all stored credentials.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gmail Integration Card */}
              <div className="p-5 bg-slate-100 border border-slate-100 rounded-2xl space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-rose-600" />
                      Google Workspace / Gmail
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Direct recruiter outreach dispatch and inbound status tracking with minimal scopes.
                    </p>
                  </div>
                  {integrations.some((i: any) => i.provider === 'GMAIL') ? (
                    <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      CONNECTED
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      DISCONNECTED
                    </span>
                  )}
                </div>

                {integrations.find((i: any) => i.provider === 'GMAIL') ? (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-700">
                      {integrations.find((i: any) => i.provider === 'GMAIL').accountEmail}
                    </span>
                    <button
                      onClick={() => disconnectMutation.mutate(integrations.find((i: any) => i.provider === 'GMAIL').id)}
                      className="text-xs text-rose-600 hover:text-rose-500 font-medium"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={async () => {
                        const res = await api.getOAuthAuthorizeUrl('GMAIL');
                        window.open(res.authorizeUrl, '_blank');
                      }}
                      className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all w-full text-center"
                    >
                      Connect Gmail OAuth 2.0
                    </button>
                  </div>
                )}
              </div>

              {/* Microsoft Outlook Card */}
              <div className="p-5 bg-slate-100 border border-slate-100 rounded-2xl space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-sky-600" />
                      Microsoft 365 / Outlook
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Exchange recruiter messages and track responses via Microsoft Graph API.
                    </p>
                  </div>
                  {integrations.some((i: any) => i.provider === 'OUTLOOK') ? (
                    <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      CONNECTED
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      DISCONNECTED
                    </span>
                  )}
                </div>

                {integrations.find((i: any) => i.provider === 'OUTLOOK') ? (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-700">
                      {integrations.find((i: any) => i.provider === 'OUTLOOK').accountEmail}
                    </span>
                    <button
                      onClick={() => disconnectMutation.mutate(integrations.find((i: any) => i.provider === 'OUTLOOK').id)}
                      className="text-xs text-rose-600 hover:text-rose-500 font-medium"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={async () => {
                        const res = await api.getOAuthAuthorizeUrl('OUTLOOK');
                        window.open(res.authorizeUrl, '_blank');
                      }}
                      className="px-3.5 py-2 bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 border border-sky-500/20 rounded-xl text-xs font-semibold transition-all w-full text-center"
                    >
                      Connect Outlook OAuth 2.0
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COMPOSE DRAFT MODAL */}
        {composeOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                Generate Grounded Recruiter Outreach
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Company Name</label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="e.g. Stripe, Figma, Datadog"
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-medium">Job Title</label>
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="e.g. Staff Infrastructure Engineer"
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Recipient Name</label>
                    <input
                      type="text"
                      value={newRecipientName}
                      onChange={(e) => setNewRecipientName(e.target.value)}
                      placeholder="e.g. Dylan Field"
                      className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Recipient Email</label>
                    <input
                      type="email"
                      value={newRecipientEmail}
                      onChange={(e) => setNewRecipientEmail(e.target.value)}
                      placeholder="e.g. dylan@figma.com"
                      className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-medium">Additional Context (Optional)</label>
                  <textarea
                    rows={2}
                    value={newContext}
                    onChange={(e) => setNewContext(e.target.value)}
                    placeholder="e.g. Passion for collaborative engines and distributed consensus"
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setComposeOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  disabled={!newCompany || !newRole || !newRecipientEmail}
                  onClick={() =>
                    createDraftMutation.mutate({
                      company: newCompany,
                      jobTitle: newRole,
                      recipientName: newRecipientName,
                      recipientEmail: newRecipientEmail,
                      context: newContext,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  Generate Grounded Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE INTERVIEW MODAL */}
        {scheduleOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                Schedule Interview Round
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Linked Application</label>
                  <select
                    value={intAppId}
                    onChange={(e) => setIntAppId(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">Select target application...</option>
                    {applications.map((app: any) => (
                      <option key={app.id} value={app.id}>
                        {app.company} — {app.jobTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Round Name</label>
                    <input
                      type="text"
                      value={intRoundName}
                      onChange={(e) => setIntRoundName(e.target.value)}
                      placeholder="e.g. Systems Deep Dive"
                      className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Round Type</label>
                    <select
                      value={intRoundType}
                      onChange={(e) => setIntRoundType(e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="Technical">Technical</option>
                      <option value="System Design">System Design</option>
                      <option value="HR / Behavioral">HR / Behavioral</option>
                      <option value="Hiring Manager">Hiring Manager</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Scheduled Date & Time</label>
                    <input
                      type="datetime-local"
                      value={intScheduledAt}
                      onChange={(e) => setIntScheduledAt(e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Duration (Minutes)</label>
                    <input
                      type="number"
                      value={intDuration}
                      onChange={(e) => setIntDuration(parseInt(e.target.value, 10))}
                      className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-medium">Meeting Link (Google Meet / Zoom)</label>
                  <input
                    type="url"
                    value={intMeetingLink}
                    onChange={(e) => setIntMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setScheduleOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  disabled={!intAppId || !intScheduledAt}
                  onClick={() =>
                    scheduleInterviewMutation.mutate({
                      applicationId: intAppId,
                      roundName: intRoundName,
                      roundType: intRoundType,
                      scheduledAt: new Date(intScheduledAt).toISOString(),
                      durationMinutes: intDuration,
                      meetingLink: intMeetingLink,
                      syncCalendar: true,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  Schedule & Prepare Questions
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SIMULATE INBOUND EMAIL MODAL */}
        {simInboundOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                Simulate Recruiter Inbound Email
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Sender Email</label>
                  <input
                    type="email"
                    value={simSender}
                    onChange={(e) => setSimSender(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-medium">Subject Line</label>
                  <input
                    type="text"
                    value={simSubject}
                    onChange={(e) => setSimSubject(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-medium">Message Snippet</label>
                  <textarea
                    rows={3}
                    value={simSnippet}
                    onChange={(e) => setSimSnippet(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setSimInboundOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    classifyMutation.mutate({
                      messageId: `msg_sim_${Date.now()}`,
                      senderEmail: simSender,
                      recipientEmail: 'candidate@example.com',
                      subject: simSubject,
                      snippet: simSnippet,
                      autoApply: true,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20"
                >
                  Classify & Ingest
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INSPECT DRAFT MODAL */}
        {selectedDraft && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {selectedDraft.company} — {selectedDraft.jobTitle}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    To: {selectedDraft.recipientName} &lt;{selectedDraft.recipientEmail}&gt;
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedDraft.status}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Subject</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-medium">Email Body</label>
                  <textarea
                    rows={8}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono resize-none leading-relaxed"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-mono text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Content Hash:</span>
                    <span className="text-slate-800">{selectedDraft.contentHash}</span>
                  </div>
                  {selectedDraft.status === 'APPROVED' && (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Locked & Approved
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setSelectedDraft(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 text-xs font-medium text-slate-700"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateDraftMutation.mutate({
                        id: selectedDraft.id,
                        data: { subject: editSubject, bodyText: editBody },
                      })
                    }
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-700 text-xs font-semibold text-slate-800 border border-slate-200"
                  >
                    Save Changes (Resets Approval)
                  </button>

                  {selectedDraft.status !== 'APPROVED' && (
                    <button
                      onClick={() =>
                        approveDraftMutation.mutate({
                          id: selectedDraft.id,
                          hash: selectedDraft.contentHash,
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-semibold border border-amber-500/30 flex items-center gap-1"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Approve & Lock Hash
                    </button>
                  )}

                  {selectedDraft.status === 'APPROVED' && (
                    <button
                      onClick={() =>
                        sendDraftMutation.mutate({
                          id: selectedDraft.id,
                          hash: selectedDraft.contentHash,
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Dispatch Email
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
