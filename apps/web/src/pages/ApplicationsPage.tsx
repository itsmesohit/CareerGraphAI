import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Columns3,
  Table as TableIcon,
  Calendar as CalendarIcon,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Plus,
  ShieldCheck,
  HelpCircle,
  Copy,
  ChevronRight,
  X,
  Sparkles,
  Video,
  UserCheck,
  FileText,
  History,
  FileCheck2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { api } from '../api/client.js';
import type {
  ApplicationSummaryDTO,
  ApplicationDetailDTO,
  InterviewScheduleDTO,
  ApplicationEventDTO,
} from '@careergraph/shared';

const STAGES = [
  { key: 'SAVED', label: 'Saved', color: 'border-slate-500/40 text-slate-700 bg-slate-500/10' },
  { key: 'PREPARING', label: 'Preparing', color: 'border-purple-500/40 text-purple-300 bg-purple-500/10' },
  { key: 'APPLIED', label: 'Applied', color: 'border-sky-500/40 text-sky-500 bg-sky-500/10' },
  { key: 'SCREENING', label: 'Screening', color: 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10' },
  { key: 'INTERVIEWING', label: 'Interviewing', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' },
  { key: 'OFFERED', label: 'Offered', color: 'border-amber-500/40 text-amber-500 bg-amber-500/10' },
  { key: 'REJECTED', label: 'Rejected', color: 'border-rose-500/40 text-rose-500 bg-rose-500/10' },
] as const;

export const ApplicationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'calendar'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for scheduling an interview
  const [interviewForm, setInterviewForm] = useState({
    roundName: 'Technical Screen',
    roundType: 'TECHNICAL' as 'HR' | 'TECHNICAL' | 'MANAGERIAL' | 'ASSIGNMENT' | 'BEHAVIORAL',
    scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    durationMinutes: 45,
    meetingLink: '',
    interviewerNames: '',
    notes: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Applications Summary
  const { data: appsData, isLoading: isAppsLoading } = useQuery({
    queryKey: ['applications', selectedStageFilter, searchQuery],
    queryFn: () =>
      api.getApplications({
        stage: selectedStageFilter !== 'ALL' ? selectedStageFilter : undefined,
        search: searchQuery || undefined,
        limit: 100,
      }),
  });

  // 2. Fetch Pending Approvals Count
  const { data: approvalsData } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => api.getPendingApprovals(),
  });

  // 3. Fetch Missing Info Count
  const { data: missingInfoData } = useQuery({
    queryKey: ['missing-info-count'],
    queryFn: () => api.getMissingInfoItems(),
  });

  // 4. Fetch Active Application Detail
  const { data: activeAppDetail, isLoading: isActiveAppLoading } = useQuery({
    queryKey: ['application-detail', activeAppId],
    queryFn: () => (activeAppId ? api.getApplication(activeAppId) : null),
    enabled: Boolean(activeAppId),
  });

  // Mutation: Update Stage
  const updateStageMutation = useMutation({
    mutationFn: ({ appId, stage }: { appId: string; stage: string }) =>
      api.updateApplicationStage(appId, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-detail'] });
      showToast('Application stage updated');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update stage');
    },
  });

  // Mutation: Schedule Interview
  const scheduleInterviewMutation = useMutation({
    mutationFn: ({ appId, data }: { appId: string; data: any }) =>
      api.scheduleInterview(appId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-detail'] });
      setIsScheduleModalOpen(false);
      showToast('Interview scheduled! Stage advanced to Interviewing.');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to schedule interview');
    },
  });

  // Drawer Active Tab
  const [drawerTab, setDrawerTab] = useState<'timeline' | 'resume' | 'coverletter' | 'qa' | 'interviews' | 'packet'>('timeline');

  // Copy Packet to clipboard
  const handleCopyPacket = async (appId: string) => {
    try {
      const res = await api.getApplicationPacket(appId);
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

  const applications = appsData?.applications || [];
  const countsByStage = appsData?.countsByStage || {};
  const pendingApprovalsCount = approvalsData?.total || 0;
  const pendingMissingCount = missingInfoData?.total || 0;

  // Flattened interviews for calendar view
  const allInterviews: Array<{ app: ApplicationSummaryDTO; interview: InterviewScheduleDTO }> = [];
  // (Interviews can be displayed when detail loaded or through a calendar feed)

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-100 border border-sky-500/40 text-sky-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-sky-600" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 via-white to-white px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 text-xs font-mono uppercase tracking-widest text-sky-600 mb-2">
              <Briefcase className="w-4 h-4" />
              <span>Application Lifecycle & Orchestration</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Application Tracker
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Track multi-stage candidate workflows, manage state machine transitions, view verified cryptographic audit logs, and copy grounded application packets.
            </p>
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/approvals"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                pendingApprovalsCount > 0
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-500 hover:bg-amber-500/25 animate-pulse'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Approval Center</span>
              {pendingApprovalsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>

            <Link
              to="/missing-info"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                pendingMissingCount > 0
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-500 hover:bg-sky-500/25 animate-pulse'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-sky-600" />
              <span>Missing Info Queue</span>
              {pendingMissingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-sky-500 text-slate-950 text-[10px] font-bold">
                  {pendingMissingCount}
                </span>
              )}
            </Link>

            <Link
              to="/jobs"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Apply to New Job</span>
            </Link>
          </div>
        </div>

        {/* Pipeline Stage Metric Pills */}
        <div className="max-w-7xl mx-auto mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {STAGES.map((s) => {
            const count = countsByStage[s.key] || 0;
            const isSelected = selectedStageFilter === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSelectedStageFilter(isSelected ? 'ALL' : s.key)}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/15 ring-1 ring-sky-500'
                    : 'border-slate-100 bg-slate-100 hover:bg-white hover:border-slate-200'
                }`}
              >
                <span className="text-[11px] text-slate-500 font-medium">{s.label}</span>
                <span className="text-xl font-extrabold text-slate-900 mt-1">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Controls Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-slate-100 p-3 rounded-2xl border border-slate-100">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by company or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-sky-500/20 text-sky-600 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-sky-500/20 text-sky-600 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-sky-500/20 text-sky-600 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Interviews</span>
            </button>
          </div>
        </div>

        {/* View Switcher Container */}
        {isAppsLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-500 gap-3">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest">Loading application pipeline...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="py-20 text-center bg-slate-100 border border-slate-100 rounded-2xl p-8">
            <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">No applications match your filter</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              Find target roles on the Discover Jobs page and click "Apply with Agent" to automatically generate grounded application packets.
            </p>
            <Link
              to="/jobs"
              className="inline-block mt-4 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 transition-colors"
            >
              Discover Target Jobs
            </Link>
          </div>
        ) : viewMode === 'kanban' ? (
          /* =========================================================================
             1. KANBAN BOARD VIEW
             ========================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 items-start">
            {STAGES.map((col) => {
              const colApps = applications.filter((a) => a.stage === col.key);
              return (
                <div
                  key={col.key}
                  className="bg-slate-100 rounded-2xl border border-slate-100 p-3 flex flex-col min-h-[500px]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        {col.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                        {colApps.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Cards */}
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {colApps.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => setActiveAppId(app.id)}
                        className="bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-sky-500/40 rounded-xl p-3.5 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          {/* Company & Match Fit */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold text-slate-700 truncate">
                              {app.company}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                app.matchScore >= 80
                                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                  : 'bg-sky-500/15 text-sky-600 border border-sky-500/30'
                              }`}
                            >
                              {app.matchScore}%
                            </span>
                          </div>

                          {/* Role Title */}
                          <h4 className="text-sm font-semibold text-slate-900 group-hover:text-sky-500 transition-colors line-clamp-2">
                            {app.jobTitle}
                          </h4>

                          {/* Location / Remote */}
                          <div className="text-[11px] text-slate-500 mt-1">
                            {app.location || (app.remoteType === 'REMOTE' ? 'Remote' : 'Location not specified')}
                          </div>
                        </div>

                        {/* Status Pills & Callouts */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                          {app.workflowStatus === 'AWAITING_APPROVAL' && (
                            <Link
                              to="/approvals"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center justify-between px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-semibold hover:bg-amber-500/25 transition-colors"
                            >
                              <span className="flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Sign-off Required
                              </span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}

                          {app.workflowStatus === 'WAITING_FOR_USER' && (
                            <Link
                              to="/missing-info"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center justify-between px-2 py-1 rounded bg-sky-500/15 border border-sky-500/30 text-sky-500 text-[10px] font-semibold hover:bg-sky-500/25 transition-colors"
                            >
                              <span className="flex items-center gap-1">
                                <HelpCircle className="w-3 h-3" /> Answer Needed
                              </span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}

                          {/* Quick Stage Mover */}
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span className="text-slate-500 font-mono">Move:</span>
                            <select
                              value={app.stage}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateStageMutation.mutate({ appId: app.id, stage: e.target.value });
                              }}
                              className="bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-sky-500"
                            >
                              {STAGES.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'table' ? (
          /* =========================================================================
             2. TABLE VIEW
             ========================================================================= */
          <div className="bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Company & Role</th>
                    <th className="py-3 px-4">Match Fit</th>
                    <th className="py-3 px-4">Pipeline Stage</th>
                    <th className="py-3 px-4">Workflow Status</th>
                    <th className="py-3 px-4">Submission Channel</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setActiveAppId(app.id)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{app.jobTitle}</div>
                        <div className="text-xs text-slate-500">{app.company}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] border ${
                            app.matchScore >= 80
                              ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                              : 'bg-sky-500/15 text-sky-600 border-sky-500/30'
                          }`}
                        >
                          {app.matchScore}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={app.stage}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateStageMutation.mutate({ appId: app.id, stage: e.target.value });
                          }}
                          className="bg-slate-900 border border-slate-200 text-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
                        >
                          {STAGES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700">
                        {app.workflowStatus}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {app.submissionChannel}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs">
                        {new Date(app.lastActivityAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPacket(app.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors"
                        >
                          Copy Packet
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAppId(app.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 text-xs font-semibold border border-sky-500/30 transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* =========================================================================
             3. INTERVIEW CALENDAR VIEW
             ========================================================================= */
          <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-sky-600" />
                  Scheduled Interview Rounds
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological schedule of technical, behavioral, and HR rounds across applications.
                </p>
              </div>
            </div>

            {applications.filter((a) => a.stage === 'INTERVIEWING').length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Video className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm">No interviews currently scheduled.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Click on any application to schedule a technical or behavioral round.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications
                  .filter((a) => a.stage === 'INTERVIEWING')
                  .map((app) => (
                    <div
                      key={app.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-base">{app.company}</span>
                          <span className="text-xs text-slate-500">• {app.jobTitle}</span>
                        </div>
                        <div className="text-xs text-sky-600 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Last Activity: {new Date(app.lastActivityAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setActiveAppId(app.id);
                            setIsScheduleModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Round</span>
                        </button>
                        <button
                          onClick={() => setActiveAppId(app.id)}
                          className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 text-xs font-semibold border border-sky-500/30 transition-colors"
                        >
                          View App Drawer
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          APPLICATION DETAILS DRAWER / MODAL
          ========================================================================= */}
      {activeAppId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-50 backdrop-blur-md flex justify-end">
          <div className="w-full max-w-2xl bg-slate-50 border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            {isActiveAppLoading || !activeAppDetail?.application ? (
              <div className="p-8 flex items-center justify-center flex-1 text-slate-500">
                <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-2" />
                <span>Loading application details...</span>
              </div>
            ) : (
              (() => {
                const app = activeAppDetail.application;
                return (
                  <>
                    <div className="p-6 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-extrabold text-lg text-slate-900">{app.company}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 border border-sky-500/30">
                              {app.matchScore}% Match
                            </span>
                          </div>
                          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{app.jobTitle}</h2>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                            <span>Stage: <strong className="text-slate-800">{app.stage}</strong></span>
                            <span>•</span>
                            <span>Status: <strong className="text-slate-800">{app.workflowStatus}</strong></span>
                            {app.contentHash && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-emerald-600 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Hash Verified
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setActiveAppId(null)}
                          className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-2.5 mt-5">
                        <button
                          onClick={() => handleCopyPacket(app.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-500 text-xs font-semibold border border-sky-500/40 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Application Packet</span>
                        </button>

                        <button
                          onClick={() => setIsScheduleModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/40 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Schedule Round</span>
                        </button>

                        {app.applyUrl && (
                          <a
                            href={app.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors ml-auto"
                          >
                            <span>Open Job URL</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Drawer Nav Tabs */}
                      <div className="flex items-center gap-2 mt-5 border-t border-slate-100 pt-3 overflow-x-auto">
                        {[
                          { id: 'timeline', label: 'Audit Timeline', icon: History },
                          { id: 'resume', label: 'Tailored Bullets', icon: FileText },
                          { id: 'coverletter', label: 'Cover Letter', icon: FileCheck2 },
                          { id: 'qa', label: 'Screening Q&A', icon: HelpCircle },
                          { id: 'interviews', label: `Interviews (${app.interviews?.length || 0})`, icon: Video },
                        ].map((t) => {
                          const Icon = t.icon;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setDrawerTab(t.id as any)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                drawerTab === t.id
                                  ? 'bg-sky-500/20 text-sky-600 border border-sky-500/30'
                                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{t.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Drawer Tab Content */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                      {/* 1. TIMELINE TAB */}
                      {drawerTab === 'timeline' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500">
                            Immutable State Machine Audit Log
                          </h4>
                          {app.events && app.events.length > 0 ? (
                            <div className="relative border-l border-slate-200 ml-3 space-y-6">
                              {app.events.map((e) => (
                                <div key={e.id} className="relative pl-6">
                                  <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-sky-500 ring-4 ring-slate-900" />
                                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="font-bold text-slate-900">{e.title}</span>
                                      <span className="text-[10px] font-mono text-slate-500">
                                        {new Date(e.createdAt).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-700">{e.description}</div>
                                    <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-slate-500">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-100">
                                        {e.actorType}
                                      </span>
                                      {e.fromStatus && e.toStatus && (
                                        <span>
                                          {e.fromStatus} → {e.toStatus}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-500 text-xs">No audit events recorded yet.</div>
                          )}
                        </div>
                      )}

                      {/* 2. TAILORED RESUME BULLETS */}
                      {drawerTab === 'resume' && (
                        <div className="space-y-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-sky-600" /> Grounded Tailored Bullets
                            </h4>
                            <p className="text-xs text-slate-500 mb-4">
                              Crafted by ResumeTailoringAgent strictly from verified candidate experience and project facts.
                            </p>
                            {app.tailoredResumeJson?.tailoredBullets &&
                            app.tailoredResumeJson.tailoredBullets.length > 0 ? (
                              <ul className="space-y-2.5">
                                {app.tailoredResumeJson.tailoredBullets.map((b: string, i: number) => (
                                  <li key={i} className="text-xs text-slate-800 flex items-start gap-2 bg-slate-100 p-2.5 rounded-lg border border-slate-100">
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span>{b}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-xs text-slate-500">No tailored bullets generated yet.</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. COVER LETTER */}
                      {drawerTab === 'coverletter' && (
                        <div className="space-y-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <FileCheck2 className="w-4 h-4 text-indigo-600" /> Tailored Cover Letter
                              </h4>
                              <button
                                onClick={async () => {
                                  if (app.coverLetterText) {
                                    await navigator.clipboard.writeText(app.coverLetterText);
                                    showToast('Cover letter copied!');
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                            </div>
                            <div className="p-4 rounded-xl bg-white border border-slate-100 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                              {app.coverLetterText || 'Cover letter will generate upon preparation.'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 4. PREPARED ANSWERS */}
                      {drawerTab === 'qa' && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500">
                            Screening Questions & Grounded Answers
                          </h4>
                          {app.preparedAnswers && Object.keys(app.preparedAnswers).length > 0 ? (
                            Object.values(app.preparedAnswers).map((qa: any, i: number) => (
                              <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                                <div className="text-xs font-bold text-slate-900">{qa.question}</div>
                                <div className="text-xs text-slate-700 bg-slate-100 p-2.5 rounded-lg border border-slate-100">
                                  {qa.answer}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                                  <span>Source: {qa.source}</span>
                                  <span>•</span>
                                  <span className="text-emerald-600">Confidence: {(qa.confidence * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500">No custom screening questions recorded.</div>
                          )}
                        </div>
                      )}

                      {/* 5. INTERVIEWS */}
                      {drawerTab === 'interviews' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500">
                              Interview Rounds
                            </h4>
                            <button
                              onClick={() => setIsScheduleModalOpen(true)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Round
                            </button>
                          </div>

                          {app.interviews && app.interviews.length > 0 ? (
                            app.interviews.map((iv) => (
                              <div key={iv.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 text-sm">{iv.roundName}</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 border border-sky-500/20">
                                    {iv.roundType}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {new Date(iv.scheduledAt).toLocaleString()} ({iv.durationMinutes} mins)
                                </div>
                                {iv.meetingLink && (
                                  <a
                                    href={iv.meetingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:underline"
                                  >
                                    <Video className="w-3.5 h-3.5" /> Meeting Link
                                  </a>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500">No interview rounds scheduled yet.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SCHEDULE INTERVIEW MODAL
          ========================================================================= */}
      {isScheduleModalOpen && activeAppId && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-emerald-600" />
                Schedule Interview Round
              </h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                scheduleInterviewMutation.mutate({
                  appId: activeAppId,
                  data: {
                    ...interviewForm,
                    scheduledAt: new Date(interviewForm.scheduledAt).toISOString(),
                    interviewerNames: interviewForm.interviewerNames
                      ? interviewForm.interviewerNames.split(',').map((s) => s.trim())
                      : [],
                  },
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Round Name</label>
                <input
                  type="text"
                  required
                  value={interviewForm.roundName}
                  onChange={(e) => setInterviewForm({ ...interviewForm, roundName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Round Type</label>
                  <select
                    value={interviewForm.roundType}
                    onChange={(e) => setInterviewForm({ ...interviewForm, roundType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                  >
                    <option value="TECHNICAL">Technical Screen</option>
                    <option value="HR">Recruiter / HR</option>
                    <option value="MANAGERIAL">Managerial</option>
                    <option value="BEHAVIORAL">Behavioral</option>
                    <option value="ASSIGNMENT">Take-Home / Presentation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={interviewForm.durationMinutes}
                    onChange={(e) => setInterviewForm({ ...interviewForm, durationMinutes: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={interviewForm.scheduledAt}
                  onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Meeting Link (Zoom / Meet)</label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={interviewForm.meetingLink}
                  onChange={(e) => setInterviewForm({ ...interviewForm, meetingLink: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Interviewer Names (Comma separated)</label>
                <input
                  type="text"
                  placeholder="Alex Rivera, Priya Patel"
                  value={interviewForm.interviewerNames}
                  onChange={(e) => setInterviewForm({ ...interviewForm, interviewerNames: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Preparation Notes</label>
                <textarea
                  rows={2}
                  placeholder="Key architecture topics or questions to ask..."
                  value={interviewForm.notes}
                  onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-200 text-slate-900 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleInterviewMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  {scheduleInterviewMutation.isPending ? 'Scheduling...' : 'Save & Advance Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
