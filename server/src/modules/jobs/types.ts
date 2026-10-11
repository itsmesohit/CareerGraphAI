export interface JobSearchQuery {
  keywords?: string;
  category?: string;
  location?: string;
  remoteOnly?: boolean;
  limit?: number;
}

export interface NormalizedJob {
  id: string;
  provider: 'REMOTIVE' | 'GREENHOUSE' | 'LEVER' | 'ADZUNA' | 'MOCK';
  providerJobId: string;
  title: string;
  company: string;
  description: string;
  url: string;
  applyUrl: string;
  location: string;
  remote: boolean;
  employmentType: string;
  seniority: 'ENTRY' | 'MID' | 'SENIOR' | 'STAFF' | 'LEAD';
  salary: string;
  publishedAt: string;
  extractedSkills: string[];
  requirements: Array<{
    text: string;
    importance: 'REQUIRED' | 'PREFERRED';
    skillName: string;
    minYears?: number;
  }>;
  fingerprint: string;
  capabilities: {
    canAutoSubmit: boolean;
    requiresApproval: boolean;
    hasApplicationForm: boolean;
  };
}

export interface JobSourceCapabilities {
  supportsKeywordSearch: boolean;
  supportsCategoryFilter: boolean;
  supportsLocationFilter: boolean;
  supportsDirectApplication: boolean;
  rateLimit: string;
  attributionRequired: boolean;
  notes: string;
}

export interface JobSource {
  readonly name: string;
  searchJobs(query: JobSearchQuery): Promise<NormalizedJob[]>;
  getJobDetails(jobId: string): Promise<NormalizedJob | null>;
  normalizeJob(rawJob: any): NormalizedJob;
  getCapabilities(): JobSourceCapabilities;
  healthCheck(): Promise<boolean>;
}
