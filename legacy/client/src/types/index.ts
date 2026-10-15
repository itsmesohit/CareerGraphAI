export type ExecutionMode = 'PREPARE_ONLY' | 'APPROVAL_REQUIRED' | 'AUTO_APPLY';

export interface CandidateProfile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  targetRole?: string;
  minSalary?: number;
  remotePref?: string;
  noticePeriod?: string;
  bio?: string;
  experiences: Array<{
    id?: string;
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  projects: Array<{
    id?: string;
    title: string;
    summary: string;
    url?: string;
    metrics?: string;
    skills: string[];
  }>;
  skills: string[];
  screeningAnswers: Array<{
    questionKey: string;
    questionText: string;
    answerText: string;
    verified: boolean;
  }>;
}

export interface JobPosting {
  id: string;
  provider: string;
  providerJobId: string;
  title: string;
  company: string;
  description: string;
  url: string;
  applyUrl: string;
  location: string;
  remote: boolean;
  employmentType: string;
  seniority: string;
  salary: string;
  publishedAt: string;
  extractedSkills: string[];
  requirements: Array<{
    text: string;
    importance: string;
    skillName: string;
  }>;
  matchScore?: number;
  matchedSkills?: string[];
  missingRequirements?: string[];
  explanation?: string;
}

export interface ApplicationItem {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  status: string;
  mode: string;
  matchScore: number;
  preparedAnswers: Record<string, string>;
  coverLetterText?: string;
  missingItems: MissingInfoItem[];
  approvalRequestedAt?: string;
  approvedAt?: string;
  submittedAt?: string;
  submissionConfirmationId?: string;
  createdAt: string;
  decisionExplanation?: string;
}

export interface MissingInfoItem {
  id: string;
  applicationId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  questionKey: string;
  questionText: string;
  reason: string;
  suggestedAnswer?: string;
  candidateAnswer?: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
}

export interface RecruiterDraft {
  id: string;
  jobId: string;
  company: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  approved: boolean;
  sent: boolean;
  sentAt?: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  agent: string;
  action: string;
  details: string;
  cypherQuery?: string;
  timestamp: string;
}

export interface GraphVisualData {
  nodes: Array<{
    id: string;
    label: string;
    properties: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
}
