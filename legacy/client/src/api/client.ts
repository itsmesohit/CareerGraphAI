import {
  CandidateProfile,
  JobPosting,
  ApplicationItem,
  MissingInfoItem,
  RecruiterDraft,
  TimelineEvent,
  GraphVisualData,
} from '../types';

const BASE_URL = '/api/v1';

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('careergraph_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.token) localStorage.setItem('careergraph_token', data.token);
    return data;
  },

  async register(name: string, email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async verifyOtp(email: string, code: string) {
    const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    if (data.token) localStorage.setItem('careergraph_token', data.token);
    return data;
  },

  async resendOtp(email: string) {
    const res = await fetch(`${BASE_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend code');
    return data;
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/auth/me`, { headers: getHeaders() });
    const data = await res.json();
    return data.user;
  },

  // Profile
  async getProfile(): Promise<CandidateProfile> {
    const res = await fetch(`${BASE_URL}/profile`, { headers: getHeaders() });
    const data = await res.json();
    return data.profile;
  },

  async updateProfile(updates: Partial<CandidateProfile>): Promise<CandidateProfile> {
    const res = await fetch(`${BASE_URL}/profile`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return data.profile;
  },

  async uploadResume(text: string) {
    const res = await fetch(`${BASE_URL}/profile/resumes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    return res.json();
  },

  // Jobs
  async getJobs(keywords = ''): Promise<JobPosting[]> {
    const res = await fetch(`${BASE_URL}/jobs/search?keywords=${encodeURIComponent(keywords)}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.jobs || [];
  },

  async triggerDiscovery(keywords = ''): Promise<JobPosting[]> {
    const res = await fetch(`${BASE_URL}/jobs/discover`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ keywords }),
    });
    const data = await res.json();
    return data.jobs || [];
  },

  async getJobMatch(jobId: string) {
    const res = await fetch(`${BASE_URL}/jobs/${jobId}/match`, { headers: getHeaders() });
    return res.json();
  },

  // Applications
  async getApplications(): Promise<ApplicationItem[]> {
    const res = await fetch(`${BASE_URL}/applications`, { headers: getHeaders() });
    const data = await res.json();
    return data.applications || [];
  },

  async prepareApplication(jobId: string, mode = 'APPROVAL_REQUIRED'): Promise<ApplicationItem> {
    const res = await fetch(`${BASE_URL}/applications`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ jobId, mode }),
    });
    const data = await res.json();
    return data.application;
  },

  async approveApplication(appId: string) {
    const res = await fetch(`${BASE_URL}/applications/${appId}/decision`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ decision: 'APPROVE' }),
    });
    return res.json();
  },

  // Missing Info
  async getMissingItems(): Promise<MissingInfoItem[]> {
    const res = await fetch(`${BASE_URL}/applications/missing-info`, { headers: getHeaders() });
    const data = await res.json();
    return data.missingItems || [];
  },

  async answerMissingItem(itemId: string, answer: string) {
    const res = await fetch(`${BASE_URL}/applications/missing-info/${itemId}/answer`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ answer }),
    });
    return res.json();
  },

  // Outreach
  async getOutreachDrafts(): Promise<RecruiterDraft[]> {
    const res = await fetch(`${BASE_URL}/outreach/drafts`, { headers: getHeaders() });
    const data = await res.json();
    return data.drafts || [];
  },

  async createOutreachDraft(params: {
    jobId?: string;
    company: string;
    jobTitle: string;
    recipientName: string;
    recipientEmail: string;
  }): Promise<RecruiterDraft> {
    const res = await fetch(`${BASE_URL}/outreach/drafts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data.draft;
  },

  async approveDraft(draftId: string) {
    const res = await fetch(`${BASE_URL}/outreach/drafts/${draftId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async sendDraft(draftId: string) {
    const res = await fetch(`${BASE_URL}/outreach/drafts/${draftId}/send`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Graph & Timeline
  async getGraph(): Promise<{ graph: GraphVisualData; mode: string }> {
    const res = await fetch(`${BASE_URL}/graph`, { headers: getHeaders() });
    return res.json();
  },

  async getTimeline(): Promise<TimelineEvent[]> {
    const res = await fetch(`${BASE_URL}/graph/timeline`, { headers: getHeaders() });
    const data = await res.json();
    return data.timeline || [];
  },

  // Integrations & Usage
  async getIntegrations() {
    const res = await fetch(`${BASE_URL}/integrations`, { headers: getHeaders() });
    return res.json();
  },

  async getUsage() {
    const res = await fetch(`${BASE_URL}/usage`, { headers: getHeaders() });
    return res.json();
  },

  // Memory & Corrections
  async recordFeedback(params: {
    questionKey: string;
    questionText: string;
    correctionText: string;
  }) {
    const res = await fetch(`${BASE_URL}/memory/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async getMemories(category?: string) {
    const res = await fetch(`${BASE_URL}/memory/search${category ? `?category=${category}` : ''}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // Notifications & Verified Domain
  async getNotificationStatus() {
    const res = await fetch(`${BASE_URL}/notifications/status`);
    return res.json();
  },

  async sendTestNotification(toEmail: string, message?: string) {
    const res = await fetch(`${BASE_URL}/notifications/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send test notification');
    return data;
  },
};
