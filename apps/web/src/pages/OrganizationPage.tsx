import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Building,
  Users,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  TrendingUp,
  Download,
  Plus,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserPlus,
  Sliders,
  DollarSign,
  ChevronRight,
  Sparkles,
  Lock,
  Eye,
  Trash2,
  Clock,
  Search,
  Settings,
  X,
} from 'lucide-react';
import {
  OrganizationDto,
  CohortDto,
  OrgInvitationDto,
  BulkCsvReportDto,
  CampusDriveDto,
  CohortAnalyticsDto,
  StudentConsentDto,
} from '@careergraph/shared';

export const OrganizationPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'cohorts' | 'roster' | 'drives' | 'consent' | 'policies'
  >('overview');

  // Selected Organization & Cohort
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');

  // Modals
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [createCohortModalOpen, setCreateCohortModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [bulkCsvModalOpen, setBulkCsvModalOpen] = useState(false);
  const [createDriveModalOpen, setCreateDriveModalOpen] = useState(false);
  const [viewApplicantsDrive, setViewApplicantsDrive] = useState<CampusDriveDto | null>(null);

  // Forms
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgType, setNewOrgType] = useState<'COLLEGE' | 'COACHING' | 'COMPANY'>('COLLEGE');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [newOrgSeats, setNewOrgSeats] = useState(50);

  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortDept, setNewCohortDept] = useState('');
  const [newCohortYear, setNewCohortYear] = useState<number>(new Date().getFullYear());
  const [newCohortDesc, setNewCohortDesc] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'CANDIDATE' | 'MENTOR' | 'ORG_ADMIN'>('CANDIDATE');
  const [inviteCohortId, setInviteCohortId] = useState('');

  const [csvContent, setCsvContent] = useState('');
  const [csvDryRunReport, setCsvDryRunReport] = useState<BulkCsvReportDto | null>(null);
  const [csvCohortId, setCsvCohortId] = useState('');

  const [driveTitle, setDriveTitle] = useState('');
  const [driveCompany, setDriveCompany] = useState('');
  const [driveDesc, setDriveDesc] = useState('');
  const [driveRoleType, setDriveRoleType] = useState('Full-Time');
  const [driveLocation, setDriveLocation] = useState('Bengaluru / Remote');
  const [driveCtcMin, setDriveCtcMin] = useState(600000);
  const [driveCtcMax, setDriveCtcMax] = useState(1800000);
  const [driveMinCgpa, setDriveMinCgpa] = useState<number>(7.0);

  // Student Consent State
  const [consentProfile, setConsentProfile] = useState(true);
  const [consentApps, setConsentApps] = useState(true);
  const [consentResumes, setConsentResumes] = useState(true);
  const [consentOffers, setConsentOffers] = useState(true);
  const [consentReview, setConsentReview] = useState(true);

  // Feedback messages
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await api.getOrganizations();
      if (res.organizations?.length && !selectedOrgId) {
        setSelectedOrgId(res.organizations[0].id);
      }
      return res;
    },
  });

  const organizations = orgsData?.organizations || [];
  const currentOrg = organizations.find((o) => o.id === selectedOrgId) || organizations[0];

  const { data: cohortsData } = useQuery({
    queryKey: ['org-cohorts', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return { cohorts: [] };
      const res = await api.getOrgCohorts(currentOrg.id);
      if (res.cohorts?.length && !selectedCohortId) {
        setSelectedCohortId(res.cohorts[0].id);
      }
      return res;
    },
    enabled: !!currentOrg?.id,
  });

  const cohorts = cohortsData?.cohorts || [];
  const activeCohort = cohorts.find((c) => c.id === selectedCohortId) || cohorts[0];

  const { data: membersData } = useQuery({
    queryKey: ['org-members', currentOrg?.id],
    queryFn: () => (currentOrg?.id ? api.getOrgMembers(currentOrg.id) : { members: [] }),
    enabled: !!currentOrg?.id,
  });

  const members = membersData?.members || [];

  const { data: analyticsData } = useQuery({
    queryKey: ['org-analytics', currentOrg?.id, activeCohort?.id],
    queryFn: () =>
      currentOrg?.id && activeCohort?.id
        ? api.getCohortAnalytics(currentOrg.id, activeCohort.id)
        : null,
    enabled: !!currentOrg?.id && !!activeCohort?.id,
  });

  const analytics = analyticsData?.analytics;

  const { data: drivesData } = useQuery({
    queryKey: ['org-drives', currentOrg?.id],
    queryFn: () => (currentOrg?.id ? api.getCampusDrives(currentOrg.id) : { drives: [] }),
    enabled: !!currentOrg?.id,
  });

  const drives = drivesData?.drives || [];

  const { data: consentData } = useQuery({
    queryKey: ['student-consent', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return null;
      const res = await api.getStudentConsent(currentOrg.id);
      if (res.consent) {
        setConsentProfile(res.consent.shareProfile);
        setConsentApps(res.consent.shareApplications);
        setConsentResumes(res.consent.shareResumes);
        setConsentOffers(res.consent.shareOffers);
        setConsentReview(res.consent.allowMentorReview);
      }
      return res;
    },
    enabled: !!currentOrg?.id,
  });

  const { data: driveApplicationsData } = useQuery({
    queryKey: ['drive-applications', currentOrg?.id, viewApplicantsDrive?.id],
    queryFn: () =>
      currentOrg?.id && viewApplicantsDrive?.id
        ? api.getCampusDriveApplications(currentOrg.id, viewApplicantsDrive.id)
        : { applications: [] },
    enabled: !!currentOrg?.id && !!viewApplicantsDrive?.id,
  });

  const driveApplications = driveApplicationsData?.applications || [];

  // Mutations
  const createOrgMutation = useMutation({
    mutationFn: (data: any) => api.createOrganization(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setSelectedOrgId(res.organization.id);
      setCreateOrgModalOpen(false);
      setActionSuccess(`Organization "${res.organization.name}" created successfully!`);
    },
    onError: (err: any) => setActionError(err.message || 'Failed to create organization'),
  });

  const createCohortMutation = useMutation({
    mutationFn: (data: any) => api.createCohort(currentOrg.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-cohorts', currentOrg?.id] });
      setCreateCohortModalOpen(false);
      setActionSuccess('Cohort batch added successfully!');
    },
    onError: (err: any) => setActionError(err.message || 'Failed to create cohort'),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => api.inviteOrgMember(currentOrg.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', currentOrg?.id] });
      setInviteModalOpen(false);
      setActionSuccess('Invitation dispatched!');
    },
    onError: (err: any) => setActionError(err.message || 'Failed to invite member'),
  });

  const bulkCsvMutation = useMutation({
    mutationFn: (data: any) => api.bulkCsvInvite(currentOrg.id, data),
    onSuccess: (res, vars) => {
      if (vars.dryRun) {
        setCsvDryRunReport(res.report);
      } else {
        queryClient.invalidateQueries({ queryKey: ['org-members', currentOrg?.id] });
        queryClient.invalidateQueries({ queryKey: ['organizations'] });
        setBulkCsvModalOpen(false);
        setCsvDryRunReport(null);
        setCsvContent('');
        setActionSuccess(`Bulk invited ${res.report.validCount} candidates successfully!`);
      }
    },
    onError: (err: any) => setActionError(err.message || 'CSV processing failed'),
  });

  const updateConsentMutation = useMutation({
    mutationFn: (data: any) => api.updateStudentConsent(currentOrg.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-consent', currentOrg?.id] });
      setActionSuccess('Consent & privacy preferences updated successfully!');
    },
    onError: (err: any) => setActionError(err.message || 'Failed to update consent'),
  });

  const createDriveMutation = useMutation({
    mutationFn: (data: any) => api.createCampusDrive(currentOrg.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-drives', currentOrg?.id] });
      setCreateDriveModalOpen(false);
      setActionSuccess('Campus drive posted to eligible cohorts!');
    },
    onError: (err: any) => setActionError(err.message || 'Failed to post campus drive'),
  });

  const applyDriveMutation = useMutation({
    mutationFn: (driveId: string) => api.applyCampusDrive(currentOrg.id, driveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-drives', currentOrg?.id] });
      setActionSuccess('Applied to campus placement drive!');
    },
    onError: (err: any) => setActionError(err.message || 'Failed to apply'),
  });

  const updateApplicantStatusMutation = useMutation({
    mutationFn: ({ driveId, appId, data }: any) =>
      api.updateDriveApplicantStatus(currentOrg.id, driveId, appId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['drive-applications', currentOrg?.id, viewApplicantsDrive?.id],
      });
      setActionSuccess('Applicant status updated!');
    },
    onError: (err: any) => setActionError(err.message || 'Status update failed'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeOrgMember(currentOrg.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', currentOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setActionSuccess('Member removed and seat reclaimed.');
    },
    onError: (err: any) => setActionError(err.message || 'Failed to remove member'),
  });

  // Calculate capacity percentage
  const seatPercentage = currentOrg
    ? Math.min(100, Math.round((currentOrg.seatsUsed / (currentOrg.seatsPurchased || 1)) * 100))
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast notifications */}
      {actionSuccess && (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600/60 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {actionError && (
        <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-600/60 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Organization Header & Switcher */}
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Building className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {currentOrg ? currentOrg.name : 'Organizations & Placement Cell'}
              </h1>
              {currentOrg && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                  {currentOrg.type}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Multi-tenant student cohort management, NIRF/NAAC accreditation reports, and campus placement drives.
            </p>
          </div>
        </div>

        {/* Action Controls & Org Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {organizations.length > 1 && (
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-2 outline-none focus:border-emerald-500"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.type})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setCreateOrgModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-slate-100/70 hover:bg-slate-700/70 rounded-xl border border-slate-200 transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>New Organization</span>
          </button>
        </div>
      </div>

      {/* Seat Capacity Meter */}
      {currentOrg && (
        <div className="bg-slate-100 border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 border border-sky-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Student Seat Capacity</div>
              <div className="text-sm font-semibold text-slate-800">
                {currentOrg.seatsUsed} / {currentOrg.seatsPurchased} Seats Allocated
              </div>
            </div>
          </div>

          <div className="w-full sm:w-72 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Utilization</span>
              <span className="font-mono text-emerald-600 font-semibold">{seatPercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  seatPercentage > 90
                    ? 'bg-rose-500'
                    : seatPercentage > 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${seatPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-emerald-500 text-emerald-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Placement Analytics
        </button>

        <button
          onClick={() => setActiveTab('cohorts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'cohorts'
              ? 'border-emerald-500 text-emerald-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Cohorts & Batches
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'roster'
              ? 'border-emerald-500 text-emerald-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Student Roster & Invites
        </button>

        <button
          onClick={() => setActiveTab('drives')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'drives'
              ? 'border-emerald-500 text-emerald-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Campus Drives
        </button>

        <button
          onClick={() => setActiveTab('consent')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'consent'
              ? 'border-emerald-500 text-emerald-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Privacy & Student Consent
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'policies'
              ? 'border-emerald-500 text-emerald-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Policies & Guardrails
        </button>
      </div>

      {/* TAB 1: PLACEMENT ANALYTICS & ACCREDITATION */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Cohort Selector & Report Download Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-100 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Active Cohort:</span>
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="bg-slate-100 border border-slate-200 text-slate-800 text-sm rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500"
              >
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.department ? `(${c.department})` : ''} - Class of {c.gradYear || 'All'}
                  </option>
                ))}
              </select>
            </div>

            {currentOrg && activeCohort && (
              <a
                href={api.getAccreditationReportUrl(currentOrg.id, activeCohort.id)}
                target="_blank"
                rel="noreferrer"
                download
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-sm font-medium transition-all"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export NIRF / NAAC Accreditation CSV</span>
              </a>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Placement Rate</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {analytics ? `${analytics.placementRate}%` : '0%'}
              </div>
              <div className="text-xs text-emerald-600/80 mt-1">
                {analytics?.placedStudents || 0} of {analytics?.totalStudents || 0} students placed
              </div>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Median Offered CTC</span>
                <DollarSign className="w-4 h-4 text-sky-600" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {analytics?.medianOfferedCtc
                  ? `₹${(analytics.medianOfferedCtc / 100000).toFixed(1)} LPA`
                  : 'N/A'}
              </div>
              <div className="text-xs text-slate-500 mt-1">Gated by student offer sharing consent</div>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Interviews Scheduled</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {analytics?.interviewsScheduled || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">Across off-campus and campus drives</div>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Offers Received</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {analytics?.offersReceived || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">Verified candidate offers</div>
            </div>
          </div>

          {/* Skill Gap Analysis & At-Risk Students */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Skill Gaps Heatmap */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Cohort Skill Gap Heatmap</h3>
                  <p className="text-xs text-slate-500">
                    High-demand industry skills missing from candidate graph memories
                  </p>
                </div>
                <Sparkles className="w-4 h-4 text-amber-600" />
              </div>

              <div className="space-y-3 pt-2">
                {analytics?.skillGaps && analytics.skillGaps.length > 0 ? (
                  analytics.skillGaps.map((sg) => (
                    <div key={sg.skill} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-700">
                        <span className="font-medium text-slate-800">{sg.skill}</span>
                        <span className="text-amber-600 font-mono">
                          {sg.studentCount} students missing (Demand: {Math.round(sg.demandScore * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, sg.demandScore * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500 py-6 text-center">
                    No critical skill gaps identified in this cohort!
                  </div>
                )}
              </div>
            </div>

            {/* At-Risk Students */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">At-Risk Students (Intervention Queue)</h3>
                  <p className="text-xs text-slate-500">
                    Students with incomplete profiles or zero application activity
                  </p>
                </div>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>

              <div className="space-y-2 pt-2">
                {analytics?.atRiskStudents && analytics.atRiskStudents.length > 0 ? (
                  analytics.atRiskStudents.map((st) => (
                    <div
                      key={st.userId}
                      className="flex items-center justify-between p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-800">{st.name}</div>
                        <div className="text-xs text-slate-500">{st.email}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/20 text-rose-500">
                          {st.reason}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Profile: {st.completeness}%
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500 py-6 text-center">
                    All students in this cohort are active and on-track!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COHORTS & BATCHES */}
      {activeTab === 'cohorts' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Student Cohorts & Batches</h2>
              <p className="text-sm text-slate-500">
                Segment candidates by department, graduation year, or specialized programs.
              </p>
            </div>
            <button
              onClick={() => setCreateCohortModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Cohort</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cohorts.map((c) => (
              <div
                key={c.id}
                className="bg-slate-100 border border-slate-200 rounded-2xl p-5 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Class of {c.gradYear || 'All'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {c.memberCount || 0} students
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-xs text-slate-500">
                    {c.department || 'General Department'} {c.description ? `• ${c.description}` : ''}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedCohortId(c.id);
                      setActiveTab('overview');
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-300 font-medium flex items-center gap-1"
                  >
                    <span>View Analytics</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setInviteCohortId(c.id);
                      setInviteModalOpen(true);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    + Invite to Batch
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT ROSTER & INVITES */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Student & Mentor Roster</h2>
              <p className="text-sm text-slate-500">
                Manage enrolled students, permissions, and bulk CSV admissions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setBulkCsvModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-700 rounded-xl border border-slate-200 transition-all"
              >
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Bulk CSV Import</span>
              </button>

              <button
                onClick={() => setInviteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite Student</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-100 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Candidate / Member</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Cohort</th>
                    <th className="px-6 py-4">Consent Flags</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{m.user?.name || 'Candidate'}</div>
                        <div className="text-xs text-slate-500">{m.user?.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-100">
                          {m.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700">
                        {m.cohort?.name || 'General'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            title="Share Profile"
                            className={`px-1.5 py-0.5 rounded ${
                              m.consent?.shareProfile ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            Profile
                          </span>
                          <span
                            title="Share Applications"
                            className={`px-1.5 py-0.5 rounded ${
                              m.consent?.shareApplications ? 'bg-sky-500/20 text-sky-500' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            Apps
                          </span>
                          <span
                            title="Share Offers"
                            className={`px-1.5 py-0.5 rounded ${
                              m.consent?.shareOffers ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            Offers
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {m.role !== 'ORG_OWNER' && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${m.user?.name || m.user?.email} and reclaim license seat?`)) {
                                removeMemberMutation.mutate(m.userId);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500 text-sm">
                        No students enrolled yet. Invite candidates or import via CSV above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CAMPUS DRIVES */}
      {activeTab === 'drives' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Campus Placement Drives</h2>
              <p className="text-sm text-slate-500">
                Exclusive company opportunities targeted to specific student cohorts.
              </p>
            </div>

            <button
              onClick={() => setCreateDriveModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Post Campus Drive</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drives.map((d) => (
              <div
                key={d.id}
                className="bg-slate-100 border border-slate-200 rounded-2xl p-5 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 border border-sky-500/20">
                      {d.roleType}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {d.applicationsCount || 0} Applicants
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{d.title}</h3>
                    <div className="text-sm text-emerald-600 font-medium">{d.companyName}</div>
                    <div className="text-xs text-slate-500 mt-1">{d.location || 'Remote / Hybrid'}</div>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2">{d.description}</p>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-700">
                    <span>
                      CTC: ₹{(d.ctcMin ? d.ctcMin / 100000 : 0).toFixed(1)}L - ₹
                      {(d.ctcMax ? d.ctcMax / 100000 : 0).toFixed(1)}L
                    </span>
                    {d.minCgpa && <span>• Min CGPA: {d.minCgpa}</span>}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setViewApplicantsDrive(d)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
                  >
                    Review Applicants
                  </button>

                  <button
                    onClick={() => applyDriveMutation.mutate(d.id)}
                    className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
            {drives.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm bg-slate-100 rounded-2xl border border-slate-100">
                No active campus drives. Post an opportunity above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: STUDENT PRIVACY & CONSENT */}
      {activeTab === 'consent' && (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 backdrop-blur-xl space-y-6 max-w-3xl">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Student Career Privacy & Data Sovereignty
            </h2>
            <p className="text-xs text-slate-500">
              In accordance with DPDP Act and GDPR compliance, control what data your placement cell and college coordinators can view.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <label className="flex items-start gap-3 p-3 bg-slate-100 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
              <input
                type="checkbox"
                checked={consentProfile}
                onChange={(e) => setConsentProfile(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Share Candidate Profile & Graph Memory</div>
                <div className="text-xs text-slate-500">
                  Allows placement officers to view your verified skills, education, and projects for matching.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-100 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
              <input
                type="checkbox"
                checked={consentApps}
                onChange={(e) => setConsentApps(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Share Application Status & Off-Campus Tracker</div>
                <div className="text-xs text-slate-500">
                  Permits placement cell to view companies applied to and current interview stages.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-100 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
              <input
                type="checkbox"
                checked={consentResumes}
                onChange={(e) => setConsentResumes(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Share Generated Resumes & Artifacts</div>
                <div className="text-xs text-slate-500">
                  Permits coordinators to view tailored resume PDF/DOCX generated for external jobs.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-100 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
              <input
                type="checkbox"
                checked={consentOffers}
                onChange={(e) => setConsentOffers(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Share Job Offers & CTC Compensation</div>
                <div className="text-xs text-slate-500">
                  Enables inclusion of your offered package in aggregate NIRF / NAAC accreditation reports.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-100 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
              <input
                type="checkbox"
                checked={consentReview}
                onChange={(e) => setConsentReview(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">Allow College Mentors to Review & Annotate</div>
                <div className="text-xs text-slate-500">
                  Enables college faculty mentors to provide feedback and suggested improvements to your profile.
                </div>
              </div>
            </label>
          </div>

          <button
            onClick={() =>
              updateConsentMutation.mutate({
                shareProfile: consentProfile,
                shareApplications: consentApps,
                shareResumes: consentResumes,
                shareOffers: consentOffers,
                allowMentorReview: consentReview,
              })
            }
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-600/25 transition-all"
          >
            Save Privacy Preferences
          </button>
        </div>
      )}

      {/* TAB 6: POLICIES & GUARDRAILS */}
      {activeTab === 'policies' && currentOrg && (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 backdrop-blur-xl space-y-6 max-w-3xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Organization Policies & Automation Guardrails</h2>
            <p className="text-xs text-slate-500">
              Global constraints enforced on student application automations.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Default Automation Mode
              </label>
              <select
                defaultValue={currentOrg.defaultAutomationMode}
                className="mt-1.5 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="MANUAL">Manual Only (No browser auto-submit)</option>
                <option value="SEMI_AUTOMATED">Semi-Automated (Assisted Autofill)</option>
                <option value="STRICT_APPROVAL">Strict Approval (Gated by Content Hash)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Max Daily Applications per Student
              </label>
              <input
                type="number"
                defaultValue={currentOrg.maxDailyApplications}
                className="mt-1.5 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Require Faculty Mentor Review Before Apply
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked={currentOrg.requireMentorReview}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-700"
                />
                <span className="text-sm text-slate-700">
                  Gate all submissions on mentor signoff
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ORGANIZATION */}
      {createOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Create New Organization</h3>
              <button onClick={() => setCreateOrgModalOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-700">Organization Name</label>
                <input
                  type="text"
                  placeholder="e.g. Indian Institute of Technology"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700">URL Slug</label>
                <input
                  type="text"
                  placeholder="e.g. iit-delhi"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700">Organization Type</label>
                <select
                  value={newOrgType}
                  onChange={(e) => setNewOrgType(e.target.value as any)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="COLLEGE">College / University</option>
                  <option value="COACHING">Coaching / BootCamp</option>
                  <option value="COMPANY">Company / Employer</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-700">Official Domain (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. iitd.ac.in"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700">Student Seats</label>
                <input
                  type="number"
                  value={newOrgSeats}
                  onChange={(e) => setNewOrgSeats(Number(e.target.value))}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setCreateOrgModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createOrgMutation.mutate({
                    name: newOrgName,
                    slug: newOrgSlug,
                    type: newOrgType,
                    domain: newOrgDomain || undefined,
                    seatsPurchased: newOrgSeats,
                  })
                }
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE COHORT */}
      {createCohortModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Create Cohort Batch</h3>
              <button onClick={() => setCreateCohortModalOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-700">Cohort Name</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science - Batch 2026"
                  value={newCohortName}
                  onChange={(e) => setNewCohortName(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700">Department</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science & Engineering"
                  value={newCohortDept}
                  onChange={(e) => setNewCohortDept(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700">Graduation Year</label>
                <input
                  type="number"
                  value={newCohortYear}
                  onChange={(e) => setNewCohortYear(Number(e.target.value))}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newCohortDesc}
                  onChange={(e) => setNewCohortDesc(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setCreateCohortModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createCohortMutation.mutate({
                    name: newCohortName,
                    department: newCohortDept || undefined,
                    gradYear: newCohortYear,
                    description: newCohortDesc || undefined,
                  })
                }
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
              >
                Create Cohort
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INVITE MEMBER */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Invite Student or Mentor</h3>
              <button onClick={() => setInviteModalOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-700">Email Address</label>
                <input
                  type="email"
                  placeholder="student@college.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700">Full Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Aryan Sharma"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="CANDIDATE">Candidate (Student)</option>
                  <option value="MENTOR">Mentor / Reviewer</option>
                  <option value="ORG_ADMIN">Placement Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-700">Assign to Cohort</label>
                <select
                  value={inviteCohortId}
                  onChange={(e) => setInviteCohortId(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">No specific cohort</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setInviteModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  inviteMutation.mutate({
                    email: inviteEmail,
                    name: inviteName || undefined,
                    role: inviteRole,
                    cohortId: inviteCohortId || undefined,
                  })
                }
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK CSV IMPORT */}
      {bulkCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Bulk CSV Student Admissions</h3>
              <button onClick={() => setBulkCsvModalOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste CSV with columns: <code className="text-emerald-600 font-mono">email,name</code>. Dry-run validation will verify seat capacity and detect duplicate records before committing.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-700">Assign Cohort</label>
                <select
                  value={csvCohortId}
                  onChange={(e) => setCsvCohortId(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">Auto-assign or default</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-700">CSV Data</label>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => {
                    setCsvContent(e.target.value);
                    setCsvDryRunReport(null);
                  }}
                  placeholder="email,name&#10;aryan@college.edu,Aryan Sharma&#10;neha@college.edu,Neha Verma"
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono outline-none focus:border-emerald-500"
                />
              </div>

              {/* Dry-run validation report */}
              {csvDryRunReport && (
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-emerald-600">
                      ✓ Valid Rows: {csvDryRunReport.validCount}
                    </span>
                    <span className="text-rose-600">
                      ✗ Invalid Rows: {csvDryRunReport.invalidCount}
                    </span>
                  </div>

                  {csvDryRunReport.errors.length > 0 && (
                    <div className="space-y-1 text-rose-500 text-[11px] max-h-24 overflow-y-auto">
                      {csvDryRunReport.errors.map((err, i) => (
                        <div key={i}>
                          Row {err.row}: {err.reason} ({err.email})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setBulkCsvModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  bulkCsvMutation.mutate({
                    csvContent,
                    cohortId: csvCohortId || undefined,
                    dryRun: true,
                  })
                }
                className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-700 text-slate-800 rounded-xl border border-slate-200"
              >
                Validate Dry-Run
              </button>

              <button
                onClick={() =>
                  bulkCsvMutation.mutate({
                    csvContent,
                    cohortId: csvCohortId || undefined,
                    dryRun: false,
                  })
                }
                disabled={csvDryRunReport ? csvDryRunReport.validCount === 0 : false}
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                Commit Invitations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POST CAMPUS DRIVE */}
      {createDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Post Campus Placement Drive</h3>
              <button onClick={() => setCreateDriveModalOpen(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700">Opportunity Title</label>
                <input
                  type="text"
                  placeholder="e.g. Graduate Software Engineer"
                  value={driveTitle}
                  onChange={(e) => setDriveTitle(e.target.value)}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Microsoft"
                    value={driveCompany}
                    onChange={(e) => setDriveCompany(e.target.value)}
                    className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700">Role Type</label>
                  <select
                    value={driveRoleType}
                    onChange={(e) => setDriveRoleType(e.target.value)}
                    className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700">Min CTC (INR)</label>
                  <input
                    type="number"
                    value={driveCtcMin}
                    onChange={(e) => setDriveCtcMin(Number(e.target.value))}
                    className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-700">Max CTC (INR)</label>
                  <input
                    type="number"
                    value={driveCtcMax}
                    onChange={(e) => setDriveCtcMax(Number(e.target.value))}
                    className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700">Minimum CGPA</label>
                <input
                  type="number"
                  step="0.1"
                  value={driveMinCgpa}
                  onChange={(e) => setDriveMinCgpa(Number(e.target.value))}
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-700">Description & Eligibility</label>
                <textarea
                  rows={3}
                  value={driveDesc}
                  onChange={(e) => setDriveDesc(e.target.value)}
                  placeholder="Comprehensive job role details, eligibility criteria, and interview process..."
                  className="mt-1 w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setCreateDriveModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createDriveMutation.mutate({
                    title: driveTitle,
                    companyName: driveCompany,
                    description: driveDesc,
                    roleType: driveRoleType,
                    location: driveLocation,
                    ctcMin: driveCtcMin,
                    ctcMax: driveCtcMax,
                    minCgpa: driveMinCgpa,
                  })
                }
                className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
              >
                Post Drive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: REVIEW DRIVE APPLICANTS */}
      {viewApplicantsDrive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Applicants: {viewApplicantsDrive.title} ({viewApplicantsDrive.companyName})
                </h3>
                <p className="text-xs text-slate-500">Advance applicants through placement rounds</p>
              </div>
              <button onClick={() => setViewApplicantsDrive(null)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {driveApplications.map((app: any) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3.5 bg-slate-100 border border-slate-100 rounded-xl text-sm"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{app.user?.name || 'Applicant'}</div>
                    <div className="text-xs text-slate-500">{app.user?.email}</div>
                    <div className="mt-1">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/20 text-sky-500">
                        Status: {app.status}
                      </span>
                      {app.offeredCtc && (
                        <span className="ml-2 text-xs text-emerald-600 font-mono">
                          Offered: ₹{(app.offeredCtc / 100000).toFixed(1)} LPA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateApplicantStatusMutation.mutate({
                          driveId: viewApplicantsDrive.id,
                          appId: app.id,
                          data: { status: 'SHORTLISTED' },
                        })
                      }
                      className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-800 rounded-lg"
                    >
                      Shortlist
                    </button>
                    <button
                      onClick={() =>
                        updateApplicantStatusMutation.mutate({
                          driveId: viewApplicantsDrive.id,
                          appId: app.id,
                          data: { status: 'INTERVIEWING' },
                        })
                      }
                      className="px-2.5 py-1 text-xs bg-amber-600/30 hover:bg-amber-600/50 text-amber-500 rounded-lg"
                    >
                      Interview
                    </button>
                    <button
                      onClick={() => {
                        const ctc = prompt('Enter offered CTC (INR)', '1200000');
                        if (ctc) {
                          updateApplicantStatusMutation.mutate({
                            driveId: viewApplicantsDrive.id,
                            appId: app.id,
                            data: { status: 'OFFERED', offeredCtc: Number(ctc) },
                          });
                        }
                      }}
                      className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                    >
                      Offer
                    </button>
                  </div>
                </div>
              ))}
              {driveApplications.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-sm">
                  No applications received yet for this campus drive.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
