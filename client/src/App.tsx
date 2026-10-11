import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingView } from './views/LandingView';
import { JobsFeedView } from './views/JobsFeedView';
import { ApplicationsView } from './views/ApplicationsView';
import { MissingInfoInboxView } from './views/MissingInfoInboxView';
import { ApprovalCenterView } from './views/ApprovalCenterView';
import { OutreachView } from './views/OutreachView';
import { GraphView } from './views/GraphView';
import { TimelineView } from './views/TimelineView';
import { ProfileView } from './views/ProfileView';
import { ResumeManagerView } from './views/ResumeManagerView';
import { IntegrationsView } from './views/IntegrationsView';
import { PreferencesView } from './views/PreferencesView';
import { UsageView } from './views/UsageView';
import { PrivacyView } from './views/PrivacyView';
import { JobMatchModal } from './components/JobMatchModal';
import { api } from './api/client';
import {
  CandidateProfile,
  JobPosting,
  ApplicationItem,
  MissingInfoItem,
  RecruiterDraft,
  TimelineEvent,
  GraphVisualData,
} from './types';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('jobs');
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [missingItems, setMissingItems] = useState<MissingInfoItem[]>([]);
  const [drafts, setDrafts] = useState<RecruiterDraft[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [graphData, setGraphData] = useState<GraphVisualData>({ nodes: [], edges: [] });
  const [falkorMode, setFalkorMode] = useState<string>('LIVE');
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);
  const [selectedMatchJob, setSelectedMatchJob] = useState<JobPosting | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      const [p, j, a, m, d, t, g] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getJobs().catch(() => []),
        api.getApplications().catch(() => []),
        api.getMissingItems().catch(() => []),
        api.getOutreachDrafts().catch(() => []),
        api.getTimeline().catch(() => []),
        api.getGraph().catch(() => ({ graph: { nodes: [], edges: [] }, mode: 'IN_MEMORY' })),
      ]);

      if (p) setProfile(p);
      setJobs(j);
      setApplications(a);
      setMissingItems(m);
      setDrafts(d);
      setTimeline(t);
      if (g) {
        setGraphData(g.graph);
        setFalkorMode(g.mode);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefreshDiscovery = async (keywords?: string) => {
    setLoadingJobs(true);
    try {
      const discovered = await api.triggerDiscovery(keywords);
      setJobs(discovered);
      // Reload timeline and graph
      const [t, g] = await Promise.all([api.getTimeline(), api.getGraph()]);
      setTimeline(t);
      setGraphData(g.graph);
      showToast(`Job discovery complete: Found and ranked ${discovered.length} live listings.`);
    } catch (err: any) {
      showToast(`Discovery error: ${err.message}`);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handlePrepareApplication = async (jobId: string) => {
    try {
      const app = await api.prepareApplication(jobId);
      await loadData();
      if (app.status === 'WAITING_FOR_USER') {
        showToast(`Workflow Paused: Job requires unverified information. Switched to Missing Info Inbox.`);
        setCurrentView('missing-info');
      } else {
        showToast(`Application Prepared! Grounded cover letter ready for review.`);
        setCurrentView('approvals');
      }
    } catch (err: any) {
      showToast(`Preparation error: ${err.message}`);
    }
  };

  const handleApproveApplication = async (appId: string) => {
    try {
      await api.approveApplication(appId);
      await loadData();
      showToast(`Application Approved! Submission verified with confirmation ID.`);
      setCurrentView('applications');
    } catch (err: any) {
      showToast(`Approval error: ${err.message}`);
    }
  };

  const handleAnswerMissingItem = async (itemId: string, answer: string) => {
    try {
      await api.answerMissingItem(itemId, answer);
      await loadData();
      showToast(`Answer persisted to FalkorDB! Application workflow resumed.`);
    } catch (err: any) {
      showToast(`Answer error: ${err.message}`);
    }
  };

  const handleCreateDraft = async (params: {
    company: string;
    jobTitle: string;
    recipientName: string;
    recipientEmail: string;
  }) => {
    try {
      await api.createOutreachDraft(params);
      await loadData();
      showToast(`Grounded recruiter outreach drafted! Ready for approval.`);
    } catch (err: any) {
      showToast(`Draft error: ${err.message}`);
    }
  };

  const handleApproveDraft = async (draftId: string) => {
    try {
      await api.approveDraft(draftId);
      await loadData();
      showToast(`Draft approved! Content is locked and authorized for dispatch.`);
    } catch (err: any) {
      showToast(`Draft approval error: ${err.message}`);
    }
  };

  const handleSendDraft = async (draftId: string) => {
    try {
      await api.sendDraft(draftId);
      await loadData();
      showToast(`Outreach email successfully sent via connected provider!`);
    } catch (err: any) {
      showToast(`Send error: ${err.message}`);
    }
  };

  const handleSaveProfile = async (updates: Partial<CandidateProfile>) => {
    try {
      const updated = await api.updateProfile(updates);
      setProfile(updated);
      const g = await api.getGraph();
      setGraphData(g.graph);
      showToast(`Career profile updated and synchronized with FalkorDB graph.`);
    } catch (err: any) {
      showToast(`Profile update error: ${err.message}`);
    }
  };

  const handleUploadResume = async (text: string) => {
    const res = await api.uploadResume(text);
    await loadData();
    showToast(`Resume parsed: Ingested ${res.extractedSkills?.length || 0} verified skills into FalkorDB.`);
    return res;
  };

  const pendingApprovalsCount = applications.filter(a => a.status === 'AWAITING_APPROVAL').length;
  const pendingMissingCount = missingItems.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl glass-panel border border-brand-500/50 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <Sparkles className="w-5 h-5 text-brand-400 shrink-0" />
          <span className="text-xs font-semibold text-white">{toastMessage}</span>
        </div>
      )}

      {/* Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        pendingApprovals={pendingApprovalsCount}
        missingItemsCount={pendingMissingCount}
        falkorMode={falkorMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'landing' && (
          <LandingView
            onStartDemo={() => setCurrentView('jobs')}
            onExploreGraph={() => setCurrentView('graph')}
          />
        )}

        {currentView === 'jobs' && (
          <JobsFeedView
            jobs={jobs}
            loading={loadingJobs}
            onRefreshDiscovery={handleRefreshDiscovery}
            onPrepareApplication={handlePrepareApplication}
            onInspectMatch={setSelectedMatchJob}
            onStartOutreach={job => {
              setCurrentView('outreach');
              handleCreateDraft({
                company: job.company,
                jobTitle: job.title,
                recipientName: 'Hiring Team',
                recipientEmail: 'recruiting@' + job.company.toLowerCase().replace(/[^a-z]/g, '') + '.example.com',
              });
            }}
          />
        )}

        {currentView === 'applications' && (
          <ApplicationsView
            applications={applications}
            onNavigateToMissingInfo={() => setCurrentView('missing-info')}
            onNavigateToApprovals={() => setCurrentView('approvals')}
            onApproveApplication={handleApproveApplication}
          />
        )}

        {currentView === 'missing-info' && (
          <MissingInfoInboxView
            missingItems={missingItems}
            onAnswerItem={handleAnswerMissingItem}
          />
        )}

        {currentView === 'approvals' && (
          <ApprovalCenterView
            applications={applications}
            onApprove={handleApproveApplication}
          />
        )}

        {currentView === 'outreach' && (
          <OutreachView
            drafts={drafts}
            onCreateDraft={handleCreateDraft}
            onApproveDraft={handleApproveDraft}
            onSendDraft={handleSendDraft}
          />
        )}

        {currentView === 'graph' && (
          <GraphView graphData={graphData} falkorMode={falkorMode} />
        )}

        {currentView === 'timeline' && <TimelineView timeline={timeline} />}

        {currentView === 'profile' && profile && (
          <ProfileView profile={profile} onSaveProfile={handleSaveProfile} />
        )}

        {currentView === 'resumes' && (
          <ResumeManagerView onUploadResume={handleUploadResume} />
        )}

        {currentView === 'integrations' && <IntegrationsView />}

        {currentView === 'preferences' && <PreferencesView />}

        {currentView === 'usage' && <UsageView />}

        {currentView === 'privacy' && profile && (
          <PrivacyView profile={profile} />
        )}
      </main>

      {/* Match Explanation Modal */}
      {selectedMatchJob && (
        <JobMatchModal
          job={selectedMatchJob}
          onClose={() => setSelectedMatchJob(null)}
          onPrepareApplication={jobId => {
            setSelectedMatchJob(null);
            handlePrepareApplication(jobId);
          }}
        />
      )}
    </div>
  );
};
