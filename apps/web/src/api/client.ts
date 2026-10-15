import {
  PlatformStatsDTO,
  LiveActivityItemDTO,
  UserDTO,
  SessionDTO,
  CandidateProfileDTO,
  ProfileUpdateInput,
  ExperienceInput,
  EducationInput,
  SkillInput,
  ProjectInput,
  CertificationInput,
  PreferencesInput,
  PreferencesDTO,
  ProfileCompletenessDTO,
  CanonicalQuestionDTO,
  CandidateAnswerInput,
  CandidateAnswerDTO,
  OnboardingStateDTO,
  ResumeExtractionResult,
  ApplicationSummaryDTO,
  ApplicationDetailDTO,
  ApplicationPacketDTO,
  MissingInfoRequestDTO,
  AddInterviewScheduleInput,
  InterviewScheduleDTO,
  PlanDto,
  SubscriptionDto,
  InvoiceDto,
  UsageSummaryDto,
  CreateCheckoutSessionInput,
  CheckoutSessionResponse,
  VerifyPaymentInput,
  OrganizationDto,
  CreateOrganizationInput,
  UpdateOrganizationPolicyInput,
  CohortDto,
  CreateCohortInput,
  StudentConsentDto,
  UpdateStudentConsentInput,
  OrgInvitationDto,
  BulkCsvInvitationInput,
  BulkCsvReportDto,
  CampusDriveDto,
  CreateCampusDriveInput,
  CohortAnalyticsDto,
  AdminPlatformStatsDto,
  AdminUserSummaryDto,
  AdminOrgSummaryDto,
  AuditLogResponseDto,
  DataExportArchiveDto,
  AccountErasureResponseDto,
  SanitizePromptResultDto,
  AIStatusDto,
  CopilotChatResponseDto,
  ResumeAtsReportDto,
  ProfileAssetsInput,
} from '@careergraph/shared';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!headers.Authorization && typeof window !== 'undefined') {
    const token = localStorage.getItem('cg_access_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const finalPath = path.startsWith(API_BASE) ? path : `${API_BASE}${path}`;
  const response = await fetch(finalPath, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    // If 401 and not a refresh/auth endpoint, try to refresh token once
    if (response.status === 401 && !retried && !path.includes('/auth/')) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (refreshRes.ok) {
          const refreshJson = await refreshRes.json();
          const newToken = refreshJson.data?.accessToken || refreshJson.accessToken;
          
          if (newToken) {
            localStorage.setItem('cg_access_token', newToken);
            // Retry original request with new token
            return request<T>(path, options, true);
          }
        }
      } catch (err) {
        console.warn('Token refresh failed:', err);
      }
    }
    
    throw new ApiError(json.message || 'Request failed', json.code || 'HTTP_ERROR', json.details);
  }

  return json.data !== undefined ? json.data : json;
}

async function requestUpload<T>(path: string, formData: FormData, token: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    credentials: 'include',
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(json.message || 'Upload failed', json.code || 'UPLOAD_ERROR', json.details);
  }

  return json;
}

export const api = {
  // Generic HTTP helpers
  get: <T>(path: string, token?: string) =>
    request<T>(path, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  post: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  put: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  delete: <T>(path: string, token?: string) =>
    request<T>(path, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Public Marketing
  getMarketingStats: () => request<PlatformStatsDTO>('/marketing/stats'),
  getMarketingActivity: () => request<LiveActivityItemDTO[]>('/marketing/activity'),

  // ── Phase 13: AI Layer ──────────────────────────────────────────────
  getAIStatus: () => request<AIStatusDto>('/ai/status'),
  copilotChat: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    request<CopilotChatResponseDto>('/ai/copilot', { method: 'POST', body: JSON.stringify({ messages }) }),

  // Auth & OTP
  register: (data: { name: string; email: string; password: string }) =>
    request<{ userId: string; email: string; name: string; requiresVerification: boolean; message: string; cooldownSeconds: number }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  verifyOtp: (data: { email: string; code: string; purpose?: string }) =>
    request<{ user: UserDTO; accessToken: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resendOtp: (data: { email: string; purpose?: string }) =>
    request<{ success: boolean; message: string; expiresAt: string; cooldownSeconds: number }>(
      '/auth/resend-otp',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  login: (data: { email: string; password: string }) =>
    request<{ user?: UserDTO; accessToken?: string; requiresVerification?: boolean; email?: string; message?: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  requestOtpLogin: (data: { email: string }) =>
    request<{ message: string; expiresAt: string; cooldownSeconds: number }>('/auth/login/otp-request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  verifyOtpLogin: (data: { email: string; code: string }) =>
    request<{ user: UserDTO; accessToken: string }>('/auth/login/otp-verify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refreshToken: () =>
    request<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  getMe: (token: string) =>
    request<UserDTO & { currentSessionId: string }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getSessions: (token: string) =>
    request<SessionDTO[]>('/auth/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  revokeSession: (sessionId: string, token: string) =>
    request<{ success: boolean }>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  revokeOtherSessions: (token: string) =>
    request<{ success: boolean }>('/auth/sessions/revoke-others', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Profile Management (Phase 2)
  getProfile: (token: string) =>
    request<{ profile: CandidateProfileDTO }>('/profile', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateProfileBasics: (data: ProfileUpdateInput, token: string) =>
    request<{ profile: CandidateProfileDTO }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  addExperience: (data: ExperienceInput, token: string) =>
    request<{ experience: any }>('/profile/experiences', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateExperience: (id: string, data: Partial<ExperienceInput>, token: string) =>
    request<{ experience: any }>(`/profile/experiences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteExperience: (id: string, token: string) =>
    request<{ success: boolean }>(`/profile/experiences/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  addEducation: (data: EducationInput, token: string) =>
    request<{ education: any }>('/profile/educations', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateEducation: (id: string, data: Partial<EducationInput>, token: string) =>
    request<{ education: any }>(`/profile/educations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteEducation: (id: string, token: string) =>
    request<{ success: boolean }>(`/profile/educations/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  addSkill: (data: SkillInput, token: string) =>
    request<{ skill: any }>('/profile/skills', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteSkill: (id: string, token: string) =>
    request<{ success: boolean }>(`/profile/skills/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  addProject: (data: ProjectInput, token: string) =>
    request<{ project: any }>('/profile/projects', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  deleteProject: (id: string, token: string) =>
    request<{ success: boolean }>(`/profile/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  getPreferences: (token: string) =>
    request<{ preferences: PreferencesDTO }>('/profile/preferences', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updatePreferences: (data: PreferencesInput, token: string) =>
    request<{ preferences: PreferencesDTO }>('/profile/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  verifyFact: (factType: string, factId: string, status: string, token: string) =>
    request<{ item: any }>(`/profile/facts/${factType}/${factId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  verifyAllFacts: (token: string) =>
    request<{ success: boolean }>('/profile/facts/verify-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),

  getCompleteness: (token: string) =>
    request<{ completeness: ProfileCompletenessDTO }>('/profile/completeness', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Resume Upload
  uploadResume: (file: File, token: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestUpload<{
      fileName: string;
      rawText: string;
      extracted: ResumeExtractionResult;
      profile: CandidateProfileDTO;
    }>('/resumes/upload', formData, token);
  },

  // Resume ATS Checker (Phase 16)
  checkResumeAts: (token: string, targetJobId?: string) =>
    request<{ report: ResumeAtsReportDto }>('/resumes/ats-check', {
      method: 'POST',
      body: JSON.stringify(targetJobId ? { targetJobId } : {}),
      headers: { Authorization: `Bearer ${token}` },
    }),

  getLatestResumeAts: (token: string) =>
    request<{
      latest: {
        score: number | null;
        grade: string | null;
        checkedAt: string | null;
        resumeFileName: string | null;
        report: ResumeAtsReportDto;
      } | null;
    }>('/resumes/ats/latest', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Profile Assets (Phase 16)
  updateProfileAssets: (data: ProfileAssetsInput, token: string) =>
    request<{ profile: CandidateProfileDTO }>('/profile/assets', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Canonical Questions & Answers
  getQuestions: (coreOnly?: boolean, category?: string) => {
    const params = new URLSearchParams();
    if (coreOnly !== undefined) params.set('coreOnly', String(coreOnly));
    if (category) params.set('category', category);
    return request<{ questions: CanonicalQuestionDTO[]; total: number }>(
      `/questions?${params.toString()}`
    );
  },

  saveAnswers: (answers: CandidateAnswerInput[], token: string) =>
    request<{ answers: CandidateAnswerDTO[] }>('/questions/answers', {
      method: 'POST',
      body: JSON.stringify({ answers }),
      headers: { Authorization: `Bearer ${token}` },
    }),

  getAnswers: (token: string) =>
    request<{ answers: CandidateAnswerDTO[] }>('/questions/answers', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Onboarding Wizard State
  getOnboardingState: (token: string) =>
    request<{ state: OnboardingStateDTO }>('/onboarding/state', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateOnboardingState: (
    data: { currentStep: number; isCompleted?: boolean; completedSteps?: number[] },
    token: string
  ) =>
    request<{ state: OnboardingStateDTO }>('/onboarding/state', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  // Applications & Pipeline Tracker
  createApplication: (data: { jobId: string; mode?: string; notes?: string }, token?: string) =>
    request<{ application: ApplicationDetailDTO; message: string }>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getApplications: (
    params?: { stage?: string; search?: string; page?: number; limit?: number },
    token?: string
  ) => {
    const q = new URLSearchParams();
    if (params?.stage) q.set('stage', params.stage);
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return request<{
      applications: ApplicationSummaryDTO[];
      countsByStage: Record<string, number>;
      total: number;
      page: number;
      limit: number;
    }>(`/applications?${q.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  getApplication: (id: string, token?: string) =>
    request<{ application: ApplicationDetailDTO }>(`/applications/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  updateApplicationStage: (
    id: string,
    data: { stage: string; rejectionReason?: string; notes?: string },
    token?: string
  ) =>
    request<{ application: ApplicationSummaryDTO }>(`/applications/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  addApplicationNote: (id: string, notes: string, token?: string) =>
    request<{ application: ApplicationDetailDTO }>(`/applications/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  scheduleInterview: (
    appIdOrData: string | {
      applicationId: string;
      roundName: string;
      roundType?: string;
      scheduledAt: string;
      durationMinutes?: number;
      meetingLink?: string;
      interviewerNames?: string[];
      notes?: string;
      syncCalendar?: boolean;
    },
    dataOrToken?: AddInterviewScheduleInput | string,
    token?: string
  ) => {
    if (typeof appIdOrData === 'string') {
      const data = dataOrToken as AddInterviewScheduleInput;
      return request<{ interview: InterviewScheduleDTO; message: string }>(`/applications/${appIdOrData}/interviews`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } else {
      const tok = typeof dataOrToken === 'string' ? dataOrToken : undefined;
      return request<{ interview: any; message?: string }>('/interviews', {
        method: 'POST',
        body: JSON.stringify(appIdOrData),
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
    }
  },

  getApplicationPacket: (id: string, token?: string) =>
    request<{ packet: ApplicationPacketDTO }>(`/applications/${id}/packet`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Missing Information Queue
  getMissingInfoItems: (token?: string) =>
    request<{ items: MissingInfoRequestDTO[]; total: number }>('/missing-info', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  resolveMissingInfoItem: (
    id: string,
    data: { candidateAnswer: string; answerScope?: string },
    token?: string
  ) =>
    request<{ item: MissingInfoRequestDTO; message: string }>(`/missing-info/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Approvals & Security Gate
  getPendingApprovals: (token?: string) =>
    request<{ approvals: ApplicationDetailDTO[]; total: number }>('/approvals', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  approveApplication: (
    id: string,
    data: { contentHash: string; submissionChannel?: string; coverLetterText?: string },
    token?: string
  ) =>
    request<{ application: ApplicationDetailDTO; message: string }>(`/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  bulkApproveApplications: (
    approvals: Array<{ applicationId: string; contentHash: string }>,
    token?: string
  ) =>
    request<{
      approvedCount: number;
      failedCount: number;
      results: Array<{ id: string; success: boolean; error?: string }>;
    }>('/approvals/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ approvals }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  rejectApplicationApproval: (id: string, reason?: string, token?: string) =>
    request<{ application: ApplicationDetailDTO; message: string }>(`/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Phase 8: Integrations & OAuth
  getIntegrations: (token?: string) =>
    request<{ integrations: any[] }>('/integrations', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getOAuthAuthorizeUrl: (provider: string, redirectUri?: string, token?: string) =>
    request<{ provider: string; authorizeUrl: string; state: string }>(
      `/integrations/oauth/${provider.toLowerCase()}/authorize${redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : ''}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    ),

  connectIntegration: (
    data: {
      provider: string;
      accountEmail: string;
      accessToken: string;
      refreshToken?: string;
      expiresInSeconds?: number;
      scopes?: string[];
    },
    token?: string
  ) =>
    request<{ integration: any }>('/integrations/connect', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  disconnectIntegration: (id: string, token?: string) =>
    request<{ message: string }>(`/integrations/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Phase 8: Recruiter Outreach
  getOutreachQuota: (token?: string) =>
    request<{ quota: { sentToday: number; dailyLimit: number; remaining: number } }>('/outreach/quota', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getOutreachList: (token?: string) =>
    request<{ outreach: any[] }>('/outreach', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  createOutreachDraft: (
    data: {
      applicationId?: string;
      company: string;
      jobTitle: string;
      recipientName: string;
      recipientEmail: string;
      context?: string;
    },
    token?: string
  ) =>
    request<{ draft: any }>('/outreach/draft', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  updateOutreachDraft: (
    id: string,
    data: { subject?: string; bodyText?: string; recipientName?: string; recipientEmail?: string; notes?: string },
    token?: string
  ) =>
    request<{ draft: any }>(`/outreach/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  approveOutreachDraft: (id: string, contentHash: string, token?: string) =>
    request<{ draft: any; message: string }>(`/outreach/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ contentHash }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  sendOutreachDraft: (id: string, contentHash: string, provider?: string, token?: string) =>
    request<{ draft: any; message: string }>(`/outreach/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ contentHash, provider }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Phase 8: Inbound Emails
  getInboundEmails: (token?: string) =>
    request<{ events: any[] }>('/inbound-emails', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  classifyInboundEmail: (
    data: {
      provider?: string;
      messageId: string;
      senderEmail: string;
      senderName?: string;
      recipientEmail: string;
      subject: string;
      snippet: string;
      receivedAt?: string;
      autoApply?: boolean;
    },
    token?: string
  ) =>
    request<{ event: any }>(`/inbound-emails/classify${data.autoApply ? '?autoApply=true' : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  resolveInboundEmail: (id: string, data: { applySuggestedStatus: boolean; notes?: string }, token?: string) =>
    request<{ event: any; message: string }>(`/inbound-emails/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Phase 8: Interviews
  getInterviews: (token?: string) =>
    request<{ interviews: any[] }>('/interviews', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),


  updateInterview: (id: string, data: any, token?: string) =>
    request<{ interview: any }>(`/interviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Phase 9: Plans, Billing & Metering
  getPlans: (tier?: 'INDIVIDUAL' | 'ORGANIZATION') =>
    request<{ plans: PlanDto[] }>(`/billing/plans${tier ? `?tier=${tier}` : ''}`),

  getSubscription: (token?: string) =>
    request<{ subscription: SubscriptionDto }>('/billing/subscription', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  createCheckoutSession: (data: CreateCheckoutSessionInput, token?: string) =>
    request<{ session: CheckoutSessionResponse }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  verifyPayment: (
    data: VerifyPaymentInput & {
      planKey?: string;
      customerGstin?: string | null;
      legalEntityName?: string | null;
      legalAddress?: string | null;
    },
    token?: string
  ) =>
    request<{ subscription: SubscriptionDto; message: string }>('/billing/verify-payment', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  cancelSubscription: (atPeriodEnd: boolean = true, token?: string) =>
    request<{ subscription: SubscriptionDto; message: string }>('/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({ atPeriodEnd }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  reactivateSubscription: (token?: string) =>
    request<{ subscription: SubscriptionDto; message: string }>('/billing/reactivate', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getUsage: (token?: string) =>
    request<{ usage: UsageSummaryDto }>('/billing/usage', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  recordUsage: (resource: string, amount: number = 1, token?: string) =>
    request<{ usage: UsageSummaryDto; message: string }>('/billing/usage/record', {
      method: 'POST',
      body: JSON.stringify({ resource, amount }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getInvoices: (token?: string) =>
    request<{ invoices: InvoiceDto[] }>('/billing/invoices', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getInvoice: (id: string, token?: string) =>
    request<{ invoice: InvoiceDto }>(`/billing/invoices/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getInvoiceDownloadUrl: (id: string) => `/api/v1/billing/invoices/${id}/download`,

  // Phase 10: Multi-Tenant Organizations (Colleges & Coaching)
  getOrganizations: (token?: string) =>
    request<{ organizations: OrganizationDto[] }>('/organizations', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getOrganization: (id: string, token?: string) =>
    request<{ organization: OrganizationDto }>(`/organizations/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  createOrganization: (data: CreateOrganizationInput, token?: string) =>
    request<{ organization: OrganizationDto }>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  updateOrgPolicy: (id: string, data: UpdateOrganizationPolicyInput, token?: string) =>
    request<{ organization: OrganizationDto }>(`/organizations/${id}/policy`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getOrgMembers: (id: string, token?: string) =>
    request<{ members: any[] }>(`/organizations/${id}/members`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  removeOrgMember: (id: string, userId: string, token?: string) =>
    request<{ message: string }>(`/organizations/${id}/members/${userId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getOrgCohorts: (id: string, token?: string) =>
    request<{ cohorts: CohortDto[] }>(`/organizations/${id}/cohorts`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  createCohort: (id: string, data: CreateCohortInput, token?: string) =>
    request<{ cohort: CohortDto }>(`/organizations/${id}/cohorts`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getOrgInvitations: (id: string, token?: string) =>
    request<{ invitations: OrgInvitationDto[] }>(`/organizations/${id}/invitations`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  inviteOrgMember: (
    id: string,
    data: { email: string; name?: string; role?: string; cohortId?: string },
    token?: string
  ) =>
    request<{ invitation: OrgInvitationDto }>(`/organizations/${id}/invitations`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  bulkCsvInvite: (id: string, data: BulkCsvInvitationInput, token?: string) =>
    request<{ report: BulkCsvReportDto }>(`/organizations/${id}/invitations/bulk-csv`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  acceptOrgInvite: (tokenStr: string, token?: string) =>
    request<{ message: string; organization: OrganizationDto }>('/organizations/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: tokenStr }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getStudentConsent: (orgId: string, token?: string) =>
    request<{ consent: StudentConsentDto }>(`/organizations/${orgId}/consent`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  updateStudentConsent: (orgId: string, data: UpdateStudentConsentInput, token?: string) =>
    request<{ consent: StudentConsentDto }>(`/organizations/${orgId}/consent`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getCampusDrives: (orgId: string, token?: string) =>
    request<{ drives: CampusDriveDto[] }>(`/organizations/${orgId}/drives`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  createCampusDrive: (orgId: string, data: CreateCampusDriveInput, token?: string) =>
    request<{ drive: CampusDriveDto }>(`/organizations/${orgId}/drives`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getCampusDriveApplications: (orgId: string, driveId: string, token?: string) =>
    request<{ applications: any[] }>(`/organizations/${orgId}/drives/${driveId}/applications`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  applyCampusDrive: (orgId: string, driveId: string, resumeUrl?: string, token?: string) =>
    request<{ application: any }>(`/organizations/${orgId}/drives/${driveId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ resumeUrl }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  updateDriveApplicantStatus: (
    orgId: string,
    driveId: string,
    appId: string,
    data: { status: string; offeredCtc?: number; notes?: string },
    token?: string
  ) =>
    request<{ application: any }>(`/organizations/${orgId}/drives/${driveId}/applications/${appId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getCohortAnalytics: (orgId: string, cohortId: string, token?: string) =>
    request<{ analytics: CohortAnalyticsDto }>(`/organizations/${orgId}/cohorts/${cohortId}/analytics`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getAccreditationReportUrl: (orgId: string, cohortId: string) =>
    `/api/v1/organizations/${orgId}/cohorts/${cohortId}/accreditation-report`,

  // Phase 11: Administration, Hardening & Security
  getAdminStats: (token?: string) =>
    request<AdminPlatformStatsDto>('/admin/stats', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getAdminUsers: (
    params?: { query?: string; role?: string; page?: number; limit?: number },
    token?: string
  ) => {
    const q = new URLSearchParams();
    if (params?.query) q.set('query', params.query);
    if (params?.role) q.set('role', params.role);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return request<{ users: AdminUserSummaryDto[]; total: number; page: number; limit: number }>(
      `/admin/users?${q.toString()}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
  },

  updateUserRole: (id: string, role: string, token?: string) =>
    request<{ user: AdminUserSummaryDto; message: string }>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  suspendUser: (id: string, isSuspended: boolean, reason?: string, token?: string) =>
    request<{ user: AdminUserSummaryDto; message: string }>(`/admin/users/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ isSuspended, reason }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  revokeUserSessions: (id: string, token?: string) =>
    request<{ revokedCount: number }>(`/admin/users/${id}/sessions`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getAdminOrganizations: (
    params?: { query?: string; page?: number; limit?: number },
    token?: string
  ) => {
    const q = new URLSearchParams();
    if (params?.query) q.set('query', params.query);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return request<{ organizations: AdminOrgSummaryDto[]; total: number; page: number; limit: number }>(
      `/admin/organizations?${q.toString()}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
  },

  updateOrgSeats: (id: string, seatsPurchased: number, token?: string) =>
    request<{ organization: AdminOrgSummaryDto; message: string }>(`/admin/organizations/${id}/seats`, {
      method: 'PATCH',
      body: JSON.stringify({ seatsPurchased }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getAdminAuditLogs: (
    params?: {
      action?: string;
      userId?: string;
      actorId?: string;
      resource?: string;
      fromDate?: string;
      toDate?: string;
      page?: number;
      limit?: number;
    },
    token?: string
  ) => {
    const q = new URLSearchParams();
    if (params?.action) q.set('action', params.action);
    if (params?.userId) q.set('userId', params.userId);
    if (params?.actorId) q.set('actorId', params.actorId);
    if (params?.resource) q.set('resource', params.resource);
    if (params?.fromDate) q.set('fromDate', params.fromDate);
    if (params?.toDate) q.set('toDate', params.toDate);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return request<AuditLogResponseDto>(`/admin/audit-logs?${q.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  testPromptInjection: (content: string, origin?: string, token?: string) =>
    request<SanitizePromptResultDto>('/admin/prompt-injection/test', {
      method: 'POST',
      body: JSON.stringify({ content, origin }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  exportUserDataArchive: (token?: string) =>
    request<DataExportArchiveDto>('/compliance/export-data', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getExportDataUrl: () => '/api/v1/compliance/export-data',

  eraseUserAccount: (confirmationPhrase: string, feedback?: string, token?: string) =>
    request<AccountErasureResponseDto>('/compliance/delete-account', {
      method: 'POST',
      body: JSON.stringify({ confirmationPhrase, feedback }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
};
