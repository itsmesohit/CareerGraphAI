import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Compass,
  Filter,
  ExternalLink,
  Plus,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Building,
  MapPin,
  DollarSign,
  ShieldAlert,
  Zap,
  Radio,
  SlidersHorizontal,
  X,
  FileText,
  Clock,
  Sparkles,
  Network,
} from 'lucide-react';
import { api } from '../api/client.js';
import type { MatchScoreResult } from '@careergraph/shared';
import { MatchBreakdownModal } from '../components/MatchBreakdownModal.js';
import { CareerGraphExplorer } from '../components/CareerGraphExplorer.js';

interface Requirement {
  id: string;
  description: string;
  skill?: string;
  isHardConstraint: boolean;
  weight: number;
  category?: string;
  minYears?: number;
}

interface JobPosting {
  id: string;
  provider: string;
  providerJobId?: string;
  company: string;
  title: string;
  description: string;
  jobUrl: string;
  applyUrl?: string;
  location?: string;
  country?: string;
  remoteType: string;
  employmentType: string;
  seniority: string;
  minSalary?: number;
  maxSalary?: number;
  currency: string;
  skills: string[];
  qualifications: string[];
  status: string;
  postedAt?: string;
  lastSeenAt?: string;
  attribution?: string;
  requirements: Requirement[];
}

interface SavedSearch {
  id: string;
  name: string;
  keywords?: string;
  location?: string;
  remoteOnly: boolean;
  minSalary?: number;
  frequency: string;
  matchCount: number;
  isActive: boolean;
}

export const JobsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [remoteFilter, setRemoteFilter] = useState<string>('ALL');
  const [seniorityFilter, setSeniorityFilter] = useState<string>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [minSalaryFilter, setMinSalaryFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  // Modals state
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<{ match: MatchScoreResult; job: JobPosting } | null>(null);
  const [graphModalJobId, setGraphModalJobId] = useState<string | null>(null);
  const [matchesMap, setMatchesMap] = useState<Record<string, MatchScoreResult>>({});
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(false);
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);

  // Import form state
  const [importUrl, setImportUrl] = useState('');
  const [importCompany, setImportCompany] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importLocation, setImportLocation] = useState('Remote');
  const [importRemoteType, setImportRemoteType] = useState('REMOTE');
  const [importMinSalary, setImportMinSalary] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Query: Jobs Feed
  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['jobs', searchTerm, remoteFilter, seniorityFilter, providerFilter, minSalaryFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('q', searchTerm);
      if (remoteFilter !== 'ALL') params.append('remoteType', remoteFilter);
      if (seniorityFilter !== 'ALL') params.append('seniority', seniorityFilter);
      if (providerFilter !== 'ALL') params.append('provider', providerFilter);
      if (minSalaryFilter) params.append('minSalary', String(minSalaryFilter));
      params.append('page', String(page));
      params.append('limit', '12');

      const res = await api.get<{
        jobs: JobPosting[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/api/v1/jobs?${params.toString()}`);
      return res;
    },
  });

  // Query: Sources & Health
  const { data: sourcesData } = useQuery({
    queryKey: ['job-sources'],
    queryFn: async () => {
      return api.get<{
        sources: Array<{
          provider: string;
          capabilities: any;
          isHealthy: boolean;
        }>;
      }>('/api/v1/jobs/sources');
    },
  });

  // Query: Saved Searches
  const { data: savedSearchesData, refetch: refetchSavedSearches } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: async () => {
      return api.get<{ savedSearches: SavedSearch[] }>('/api/v1/jobs/saved-searches');
    },
  });

  // Query: Top Matches Preloader (Spec §10)
  const { data: topMatchesData } = useQuery({
    queryKey: ['top-matches'],
    queryFn: async () => {
      return api.get<{ matches: MatchScoreResult[] }>('/api/v1/matches/top?limit=40');
    },
  });

  // Query: Graph Nodes for evidence modal
  const { data: graphNodesData } = useQuery({
    queryKey: ['graph-nodes-modal'],
    queryFn: async () => {
      return api.get<{ nodes: any[]; edges: any[] }>('/api/v1/graph/nodes');
    },
    enabled: !!graphModalJobId,
  });

  // Populate matchesMap whenever topMatchesData updates
  React.useEffect(() => {
    if (topMatchesData?.matches) {
      const nextMap: Record<string, MatchScoreResult> = {};
      topMatchesData.matches.forEach((m) => {
        nextMap[m.jobId] = m;
      });
      setMatchesMap((prev) => ({ ...prev, ...nextMap }));
    }
  }, [topMatchesData]);

  // Mutation: Trigger Discovery
  const discoverMutation = useMutation({
    mutationFn: async () => {
      return api.post<{
        discoveredCount: number;
        updatedCount: number;
        totalIngested: number;
      }>('/api/v1/jobs/discover', { limit: 15 });
    },
    onSuccess: (data) => {
      setStatusNotification(
        `Discovery finished: ${data.discoveredCount} new jobs found, ${data.updatedCount} existing listings refreshed.`
      );
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setTimeout(() => setStatusNotification(null), 5000);
    },
  });

  // Mutation: Import Job URL
  const importMutation = useMutation({
    mutationFn: async () => {
      setImportError(null);
      return api.post<{ job: JobPosting }>('/api/v1/jobs/import-url', {
        url: importUrl,
        company: importCompany || undefined,
        title: importTitle || undefined,
        description: importDescription || undefined,
        location: importLocation || undefined,
        remoteType: importRemoteType,
        minSalary: importMinSalary ? parseInt(importMinSalary, 10) : undefined,
      });
    },
    onSuccess: () => {
      setImportModalOpen(false);
      setImportUrl('');
      setImportCompany('');
      setImportTitle('');
      setImportDescription('');
      setImportMinSalary('');
      setStatusNotification('Job successfully imported and normalized into your feed.');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setTimeout(() => setStatusNotification(null), 4000);
    },
    onError: (err: any) => {
      setImportError(err.message || 'Failed to import job');
    },
  });

  // Mutation: Auto-generate saved searches
  const autoGenerateSearchesMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ message: string; savedSearches: SavedSearch[] }>(
        '/api/v1/jobs/saved-searches/auto-generate',
        {}
      );
    },
    onSuccess: (data) => {
      setStatusNotification(data.message);
      refetchSavedSearches();
      setTimeout(() => setStatusNotification(null), 4000);
    },
  });

  // Mutation: Verify Freshness
  const verifyFreshnessMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return api.post<{ message: string; isLive: boolean }>(
        `/api/v1/jobs/${jobId}/verify-freshness`,
        {}
      );
    },
    onSuccess: (data) => {
      setStatusNotification(`Freshness verified: ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setTimeout(() => setStatusNotification(null), 4000);
    },
  });

  // Check if URL is prohibited for automated headless scraping
  const isProhibitedDomain =
    importUrl.includes('linkedin.com') ||
    importUrl.includes('indeed.com') ||
    importUrl.includes('naukri.com') ||
    importUrl.includes('glassdoor.com');

  return (
    <div className="min-h-screen bg-dark-primary">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-grid-dark opacity-30 pointer-events-none" />
      {/* Gradient Glow */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-accent-cyan/15 via-accent-blue/10 to-transparent blur-3xl pointer-events-none -z-10" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Notification Toast */}
      {statusNotification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-dark-elevated/95 border border-accent-cyan/40 text-white text-sm rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-5 h-5 text-accent-cyan shrink-0" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-dark-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Job Discovery Engine
            </h1>
            <span className="badge badge-info">
              Live Feed
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Autonomous multi-source job aggregation with deduplication, requirement extraction, and multi-hop graph indexing.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            className="btn-primary px-3.5 py-2 text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Compass className={`w-4 h-4 ${discoverMutation.isPending ? 'animate-spin' : ''}`} />
            {discoverMutation.isPending ? 'Discovering...' : 'Discover Jobs'}
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="btn-secondary px-3.5 py-2 text-xs sm:text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-accent-cyan" />
            Import URL / Paste
          </button>

          <button
            onClick={() => setSavedSearchesOpen(true)}
            className="btn-secondary px-3.5 py-2 text-xs sm:text-sm flex items-center gap-2"
          >
            <Bookmark className="w-4 h-4 text-accent-violet" />
            Saved Searches
          </button>

          <button
            onClick={() => setSourcesModalOpen(true)}
            className="glass-panel px-3 py-2 text-xs flex items-center gap-2 rounded-xl border border-light-border hover:border-accent-cyan/40 text-light-text-secondary hover:text-dark-text transition-all"
            title="Inspect Live Adapters Health"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            Sources
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="dark-panel-elevated rounded-2xl p-4 my-6 backdrop-blur-sm space-y-3 border border-dark-border">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, company, or technology (e.g. Distributed Systems, TypeScript)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-elevated border border-dark-border text-white placeholder-slate-500 text-sm focus:outline-none focus:border-accent-cyan/60 focus:ring-1 focus:ring-accent-cyan/30 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={remoteFilter}
              onChange={(e) => {
                setRemoteFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-xl bg-dark-elevated border border-dark-border text-white text-xs sm:text-sm focus:outline-none focus:border-accent-cyan"
            >
              <option value="ALL">All Workplaces</option>
              <option value="REMOTE">Remote Only</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ONSITE">On-site</option>
            </select>

            <select
              value={seniorityFilter}
              onChange={(e) => {
                setSeniorityFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-xl bg-dark-elevated border border-dark-border text-white text-xs sm:text-sm focus:outline-none focus:border-accent-cyan"
            >
              <option value="ALL">All Seniorities</option>
              <option value="ENTRY">Entry Level</option>
              <option value="MID">Mid Level</option>
              <option value="SENIOR">Senior</option>
              <option value="LEAD">Lead / Staff</option>
            </select>

            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-xl bg-dark-elevated border border-dark-border text-white text-xs sm:text-sm focus:outline-none focus:border-accent-cyan"
            >
              <option value="ALL">All Providers</option>
              <option value="REMOTIVE">Remotive</option>
              <option value="GREENHOUSE">Greenhouse</option>
              <option value="LEVER">Lever</option>
              <option value="ASHBY">Ashby</option>
              <option value="ADZUNA">Adzuna</option>
              <option value="USER_PASTED">User Imported</option>
            </select>
          </div>
        </div>

        {/* Quick Filters Pill Bar */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-dark-border">
          <div className="flex items-center gap-2 text-slate-400">
            <span>Minimum Salary:</span>
            {[100000, 140000, 180000].map((sal) => (
              <button
                key={sal}
                onClick={() => setMinSalaryFilter(minSalaryFilter === sal ? undefined : sal)}
                className={`px-2 py-0.5 rounded-lg border transition-all ${
                  minSalaryFilter === sal
                    ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40'
                    : 'bg-dark-elevated text-slate-400 border-dark-border hover:text-white'
                }`}
              >
                ${(sal / 1000).toFixed(0)}k+
              </button>
            ))}
          </div>

          <div className="text-slate-400">
            {jobsData?.total !== undefined ? `${jobsData.total} openings discovered` : 'Scanning jobs...'}
          </div>
        </div>
      </div>

      {/* Job Postings Grid */}
      {jobsLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-widest uppercase">Aggregating live opportunities...</span>
        </div>
      ) : !jobsData?.jobs || jobsData.jobs.length === 0 ? (
        <div className="py-16 text-center dark-panel-elevated border border-dark-border rounded-2xl p-8">
          <Compass className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No job openings found</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
            Try adjusting your search keywords, clear filters, or click "Discover Jobs" above to run an active discovery sweep across Remotive, Greenhouse, and Lever boards.
          </p>
          <button
            onClick={() => discoverMutation.mutate()}
            className="btn-primary mt-4 px-4 py-2 text-sm"
          >
            Run Job Discovery Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobsData.jobs.map((job) => (
            <div
              key={job.id}
              className="dark-panel-elevated border border-dark-border hover:border-accent-cyan/40 rounded-2xl p-5 flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-accent-cyan/5"
            >
              <div>
                {/* Header: Company & Provider Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accent-cyan/20 to-accent-blue/20 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan font-bold text-xs">
                      {job.company.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-white text-sm truncate max-w-[150px]">
                      {job.company}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {matchesMap[job.id] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMatch({ match: matchesMap[job.id], job });
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-transform hover:scale-105 ${
                          matchesMap[job.id].isEliminated
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : matchesMap[job.id].overallScore >= 80
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : matchesMap[job.id].overallScore >= 65
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                        title="Click to view match explanation"
                      >
                        {matchesMap[job.id].isEliminated ? 'Disqualified' : `${matchesMap[job.id].overallScore}% Fit`}
                      </button>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                        job.provider === 'REMOTIVE'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : job.provider === 'GREENHOUSE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : job.provider === 'LEVER'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          : job.provider === 'ASHBY'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {job.provider}
                    </span>
                  </div>
                </div>

                {/* Job Title */}
                <h3 className="text-base font-bold text-white group-hover:text-accent-cyan transition-colors line-clamp-2 mb-2">
                  {job.title}
                </h3>

                {/* Badges: Location, Seniority, Salary */}
                <div className="flex items-center flex-wrap gap-2 text-xs text-slate-400 mb-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {job.location || 'Remote'}
                  </span>
                  {job.remoteType === 'REMOTE' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
                      Remote
                    </span>
                  )}
                  {job.minSalary && (
                    <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                      <DollarSign className="w-3 h-3" />
                      {job.minSalary.toLocaleString()}
                      {job.maxSalary ? ` - ${job.maxSalary.toLocaleString()}` : '+'}
                    </span>
                  )}
                </div>

                {/* Extracted Skills Pills */}
                {job.skills && job.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {job.skills.slice(0, 4).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-dark-secondary border border-dark-border text-slate-300 text-[11px]"
                      >
                        {skill}
                      </span>
                    ))}
                    {job.skills.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] text-slate-500">
                        +{job.skills.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      if (matchesMap[job.id]) {
                        setSelectedMatch({ match: matchesMap[job.id], job });
                        return;
                      }
                      setLoadingMatchId(job.id);
                      try {
                        const res = await api.get<{ match: MatchScoreResult }>(`/api/v1/matches/jobs/${job.id}`);
                        setMatchesMap((prev) => ({ ...prev, [job.id]: res.match }));
                        setSelectedMatch({ match: res.match, job });
                      } catch (err: any) {
                        setStatusNotification(err.message || 'Failed to compute match score');
                      } finally {
                        setLoadingMatchId(null);
                      }
                    }}
                    disabled={loadingMatchId === job.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 text-xs font-semibold border border-sky-500/20 transition-colors"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${loadingMatchId === job.id ? 'animate-spin' : ''}`} />
                    <span>
                      {matchesMap[job.id]
                        ? matchesMap[job.id].isEliminated
                          ? 'Eliminated'
                          : `${matchesMap[job.id].overallScore}% Fit`
                        : 'Match'}
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedJob(job)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-medium border border-slate-100 transition-colors"
                  >
                    Reqs
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => verifyFreshnessMutation.mutate(job.id)}
                    title="Verify listing is still open"
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        setStatusNotification(`Initiating agent application for ${job.company}...`);
                        const res = await api.createApplication({ jobId: job.id, mode: 'APPROVAL_REQUIRED' });
                        setStatusNotification(
                          `Application created! Status: ${res.application.workflowStatus}. Check Applications or Approvals.`
                        );
                      } catch (err: any) {
                        setStatusNotification(err.message || 'Failed to start application');
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition-all hover:scale-105"
                    title="Orchestrate specialist agents to tailor resume and draft cover letter"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Apply with Agent</span>
                  </button>

                  <a
                    href={job.applyUrl || job.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-medium transition-colors"
                  >
                    <span>Direct</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {jobsData && jobsData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500 px-3">
            Page {page} of {jobsData.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(jobsData.totalPages, p + 1))}
            disabled={page === jobsData.totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: Job Details & Structured Requirements Breakdown             */}
      {/* ------------------------------------------------------------------- */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-500">{selectedJob.company}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-500/10 text-sky-600 border border-sky-500/30">
                    {selectedJob.provider}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                    {selectedJob.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedJob.title}</h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {selectedJob.location || 'Remote'}
                  </span>
                  {selectedJob.minSalary && (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <DollarSign className="w-3.5 h-3.5" /> ${selectedJob.minSalary.toLocaleString()}
                      {selectedJob.maxSalary ? ` - $${selectedJob.maxSalary.toLocaleString()}` : ''}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Structured Requirements Section */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-600 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Extracted Job Requirements ({selectedJob.requirements.length})
                </h3>
                <div className="space-y-2">
                  {selectedJob.requirements.map((req, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                        req.isHardConstraint
                          ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                          : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {req.isHardConstraint ? (
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{req.description}</p>
                          {req.skill && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-sky-500/15 text-sky-500 text-[10px] font-mono">
                              Skill: {req.skill}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            req.isHardConstraint
                              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {req.isHardConstraint ? 'Mandatory Constraint' : `Weight: ${req.weight}x`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Job Description Body */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Full Role Description
                </h3>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {selectedJob.description}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Attribution: {selectedJob.attribution || selectedJob.provider}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const currentJob = selectedJob;
                    if (matchesMap[currentJob.id]) {
                      setSelectedJob(null);
                      setSelectedMatch({ match: matchesMap[currentJob.id], job: currentJob });
                      return;
                    }
                    setLoadingMatchId(currentJob.id);
                    try {
                      const res = await api.get<{ match: MatchScoreResult }>(`/api/v1/matches/jobs/${currentJob.id}`);
                      setMatchesMap((prev) => ({ ...prev, [currentJob.id]: res.match }));
                      setSelectedJob(null);
                      setSelectedMatch({ match: res.match, job: currentJob });
                    } catch (err: any) {
                      setStatusNotification(err.message || 'Failed to compute match score');
                    } finally {
                      setLoadingMatchId(null);
                    }
                  }}
                  disabled={loadingMatchId === selectedJob.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 text-xs font-semibold border border-sky-500/20 transition-colors"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${loadingMatchId === selectedJob.id ? 'animate-spin' : ''}`} />
                  <span>
                    {matchesMap[selectedJob.id]
                      ? `Match: ${matchesMap[selectedJob.id].overallScore}%`
                      : 'Evaluate Match'}
                  </span>
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Close
                </button>
                <a
                  href={selectedJob.applyUrl || selectedJob.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-sky-500/20 transition-all"
                >
                  <span>Proceed to Apply</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: Import Job URL / Manual Description Paste                  */}
      {/* ------------------------------------------------------------------- */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                <h2 className="text-lg font-bold text-slate-900">Import Opportunity</h2>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                importMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Job URL (Any Site) *
                </label>
                <input
                  type="url"
                  required
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://company.com/careers/senior-engineer"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Compliance Warning for LinkedIn / Indeed */}
              {isProhibitedDomain && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Compliance Notice:</span>
                    Automated background scraping of this domain is restricted by its Terms of Service. Please paste the job title and description below to create a verified card cleanly.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Company {isProhibitedDomain && '*'}
                  </label>
                  <input
                    type="text"
                    required={isProhibitedDomain}
                    value={importCompany}
                    onChange={(e) => setImportCompany(e.target.value)}
                    placeholder="e.g. Stripe, OpenAI"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Role Title {isProhibitedDomain && '*'}
                  </label>
                  <input
                    type="text"
                    required={isProhibitedDomain}
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Job Description {isProhibitedDomain && '*'}
                </label>
                <textarea
                  rows={4}
                  required={isProhibitedDomain}
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  placeholder="Paste job description requirements, responsibilities, and qualifications..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Workplace
                  </label>
                  <select
                    value={importRemoteType}
                    onChange={(e) => setImportRemoteType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ONSITE">On-site</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Min Salary (USD)
                  </label>
                  <input
                    type="number"
                    value={importMinSalary}
                    onChange={(e) => setImportMinSalary(e.target.value)}
                    placeholder="e.g. 150000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-500 text-xs">
                  {importError}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  {importMutation.isPending ? 'Importing...' : 'Import to Feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: Saved Searches & Profile Auto-Generation                   */}
      {/* ------------------------------------------------------------------- */}
      {savedSearchesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-bold text-slate-900">Saved Job Searches</h2>
              </div>
              <button
                onClick={() => setSavedSearchesOpen(false)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4">
              <button
                onClick={() => autoGenerateSearchesMutation.mutate()}
                disabled={autoGenerateSearchesMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-600 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-sky-600" />
                {autoGenerateSearchesMutation.isPending
                  ? 'Analyzing Profile...'
                  : 'Auto-Generate Searches from Profile Preferences'}
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {!savedSearchesData?.savedSearches || savedSearchesData.savedSearches.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No saved searches active. Click auto-generate above to initialize.
                </div>
              ) : (
                savedSearchesData.savedSearches.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{s.name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>Keywords: {s.keywords || 'Any'}</span>
                        <span>•</span>
                        <span>{s.frequency} frequency</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (s.keywords) setSearchTerm(s.keywords);
                        setSavedSearchesOpen(false);
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-50 hover:bg-slate-200 text-xs text-sky-600 font-medium transition-colors"
                    >
                      Run Search
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSavedSearchesOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 4: Sources Catalog & Health Status                            */}
      {/* ------------------------------------------------------------------- */}
      {sourcesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Job Sources Registry (Spec §9)</h2>
              </div>
              <button
                onClick={() => setSourcesModalOpen(false)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 max-h-80 overflow-y-auto">
              {sourcesData?.sources.map((src) => (
                <div
                  key={src.provider}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{src.provider}</span>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        src.isHealthy
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          src.isHealthy ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      {src.isHealthy ? 'Connected' : 'Standby / Unconfigured'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">{src.capabilities.notes}</p>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Rate limits: {src.capabilities.rateLimit}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSourcesModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 5: Explainable Match Breakdown Modal                          */}
      {/* ------------------------------------------------------------------- */}
      {selectedMatch && (
        <MatchBreakdownModal
          match={selectedMatch.match}
          jobTitle={selectedMatch.job.title}
          jobCompany={selectedMatch.job.company}
          applyUrl={selectedMatch.job.applyUrl || selectedMatch.job.jobUrl}
          onClose={() => setSelectedMatch(null)}
          onOpenGraph={(jobId) => {
            setSelectedMatch(null);
            setGraphModalJobId(jobId);
          }}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 6: Multi-Hop Evidence Graph Modal                             */}
      {/* ------------------------------------------------------------------- */}
      {graphModalJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-6xl h-[85vh] bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Network className="w-4 h-4 text-sky-600" />
                Multi-Hop Evidence Graph Highlight
              </h3>
              <button
                onClick={() => setGraphModalJobId(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-2">
              <CareerGraphExplorer
                nodes={graphNodesData?.nodes || []}
                edges={graphNodesData?.edges || []}
                highlightJobId={graphModalJobId}
                onClose={() => setGraphModalJobId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
