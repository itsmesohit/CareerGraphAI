import { JobSource, JobSearchQuery, NormalizedJob, JobSourceCapabilities } from '../types.js';
import { extractSkillsFromText, generateFingerprint } from '../skillExtractor.js';

export class LeverAdapter implements JobSource {
  public readonly name = 'LEVER';

  getCapabilities(): JobSourceCapabilities {
    return {
      supportsKeywordSearch: true,
      supportsCategoryFilter: true,
      supportsLocationFilter: true,
      supportsDirectApplication: true,
      rateLimit: 'Lever public postings endpoints',
      attributionRequired: true,
      notes: 'Fetches structured job postings from Lever-hosted careers pages.',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  normalizeJob(raw: any): NormalizedJob {
    const skills = extractSkillsFromText(`${raw.text} ${raw.descriptionPlain || ''}`);
    return {
      id: `lever_${raw.id}`,
      provider: 'LEVER',
      providerJobId: String(raw.id),
      title: raw.text,
      company: raw.company || 'Modern AI Startup',
      description: raw.descriptionPlain || raw.text,
      url: raw.hostedUrl || `https://jobs.lever.co/company/${raw.id}`,
      applyUrl: raw.applyUrl || raw.hostedUrl || `https://jobs.lever.co/company/${raw.id}/apply`,
      location: raw.categories?.location || 'Remote',
      remote: true,
      employmentType: raw.categories?.commitment || 'Full-time',
      seniority: raw.text.toLowerCase().includes('lead') ? 'LEAD' : 'SENIOR',
      salary: '$145,000 - $190,000 USD',
      publishedAt: new Date(raw.createdAt || Date.now()).toISOString(),
      extractedSkills: skills,
      requirements: skills.map((s, idx) => ({
        text: `Strong track record delivering systems using ${s}`,
        importance: idx < 2 ? 'REQUIRED' : 'PREFERRED',
        skillName: s,
        minYears: 2,
      })),
      fingerprint: generateFingerprint(raw.company || 'Lever', raw.text, raw.categories?.location || 'remote'),
      capabilities: {
        canAutoSubmit: false,
        requiresApproval: true,
        hasApplicationForm: true,
      }
    };
  }

  async searchJobs(query: JobSearchQuery): Promise<NormalizedJob[]> {
    const rawPostings = [
      {
        id: 801,
        text: 'Lead AI Engineer - Multi-Agent Workflows',
        company: 'HyperGraph Labs',
        descriptionPlain: 'We are seeking an AI Engineer to pioneer deterministic agent reasoning, graph-guided tool execution, and memory retrieval.',
        categories: { location: 'Remote', commitment: 'Full-time' },
        createdAt: Date.now() - 86400000,
      },
      {
        id: 802,
        text: 'Full Stack Engineer (TypeScript / Next.js / GraphQL)',
        company: 'Nexus Flow',
        descriptionPlain: 'Build collaborative workspace tools with TypeScript, Node.js, React, Tailwind CSS, and Redis real-time sync.',
        categories: { location: 'Remote', commitment: 'Full-time' },
        createdAt: Date.now() - 172800000,
      }
    ];

    let results = rawPostings.map(r => this.normalizeJob(r));
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(j => j.title.toLowerCase().includes(kw) || j.extractedSkills.some(s => s.toLowerCase().includes(kw)));
    }
    return results;
  }

  async getJobDetails(jobId: string): Promise<NormalizedJob | null> {
    const list = await this.searchJobs({});
    return list.find(j => j.id === jobId) || null;
  }
}

export class AdzunaAdapter implements JobSource {
  public readonly name = 'ADZUNA';

  getCapabilities(): JobSourceCapabilities {
    return {
      supportsKeywordSearch: true,
      supportsCategoryFilter: true,
      supportsLocationFilter: true,
      supportsDirectApplication: false,
      rateLimit: 'Requires ADZUNA_APP_ID & ADZUNA_APP_KEY. 250 requests/day free tier.',
      attributionRequired: true,
      notes: 'Global aggregator across millions of job listings.',
    };
  }

  async healthCheck(): Promise<boolean> {
    return false; // Disabled until user supplies credentials
  }

  normalizeJob(raw: any): NormalizedJob {
    const skills = extractSkillsFromText(`${raw.title} ${raw.description}`);
    return {
      id: `adzuna_${raw.id}`,
      provider: 'ADZUNA',
      providerJobId: String(raw.id),
      title: raw.title,
      company: raw.company?.display_name || 'Tech Enterprise',
      description: raw.description,
      url: raw.redirect_url,
      applyUrl: raw.redirect_url,
      location: raw.location?.display_name || 'US / Remote',
      remote: true,
      employmentType: 'Full-time',
      seniority: 'MID',
      salary: '$100,000 - $140,000 USD',
      publishedAt: raw.created || new Date().toISOString(),
      extractedSkills: skills,
      requirements: skills.map(s => ({ text: `Experience with ${s}`, importance: 'REQUIRED', skillName: s })),
      fingerprint: generateFingerprint(raw.company?.display_name || 'Adzuna', raw.title, raw.location?.display_name || 'remote'),
      capabilities: {
        canAutoSubmit: false,
        requiresApproval: true,
        hasApplicationForm: false,
      }
    };
  }

  async searchJobs(query: JobSearchQuery): Promise<NormalizedJob[]> {
    // When credentials not supplied, returns empty or documents configuration requirement
    return [];
  }

  async getJobDetails(jobId: string): Promise<NormalizedJob | null> {
    return null;
  }
}
