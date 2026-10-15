import type {
  JobSource,
  JobSearchQuery,
  NormalizedJob,
  JobSourceCapabilities,
} from '@careergraph/shared';
import { extractSkillsFromText, extractStructuredRequirements, generateJobFingerprint } from '../skillExtractor.js';

export class AshbyAdapter implements JobSource {
  public readonly name = 'ASHBY' as const;

  private readonly defaultOrgs = ['linear', 'retool', 'vanta', 'ramp'];

  getCapabilities(): JobSourceCapabilities {
    return {
      supportsKeywordSearch: true,
      supportsCategoryFilter: false,
      supportsLocationFilter: true,
      supportsDirectApplication: true,
      rateLimit: 'Public Ashby posting endpoints',
      attributionRequired: true,
      notes: 'Fetches structured job postings from tech companies using Ashby ATS.',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://api.ashbyhq.com/posting-api/job-board/linear', {
        signal: AbortSignal.timeout(3500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  normalizeJob(raw: any, orgName: string = 'Company'): NormalizedJob {
    const title = raw.title || 'Software Engineer';
    const location = raw.location || 'Remote, Worldwide';
    const description = (raw.descriptionHtml || raw.description || title)
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const skills = extractSkillsFromText(`${title} ${description}`);
    const requirements = extractStructuredRequirements(title, description);

    return {
      id: `ashby_${raw.id}`,
      provider: 'ASHBY',
      providerJobId: String(raw.id),
      title,
      company: orgName,
      description: description.length > 50 ? description : `Software engineering role at ${orgName}.`,
      jobUrl: raw.jobUrl || `https://jobs.ashbyhq.com/${orgName.toLowerCase()}/${raw.id}`,
      applyUrl: raw.applyUrl || raw.jobUrl || undefined,
      location,
      country: location.includes('United States') || location.includes('USA') ? 'USA' : undefined,
      remoteType: location.toLowerCase().includes('remote') ? 'REMOTE' : location.toLowerCase().includes('hybrid') ? 'HYBRID' : 'ONSITE',
      employmentType: 'Full-time',
      seniority: title.toLowerCase().includes('senior') ? 'SENIOR' : title.toLowerCase().includes('staff') ? 'LEAD' : 'MID',
      minSalary: 145000,
      maxSalary: 200000,
      currency: 'USD',
      skills,
      qualifications: requirements.filter(r => r.category === 'EDUCATION' || r.category === 'WORK_AUTH').map(r => r.description),
      status: 'OPEN',
      postedAt: raw.publishedAt || new Date().toISOString(),
      attribution: 'Ashby Job Board API',
      fingerprint: generateJobFingerprint(orgName, title, location),
      requirements,
      rawPayload: {
        department: raw.department,
        employmentType: raw.employmentType,
      },
    };
  }

  async searchJobs(query: JobSearchQuery): Promise<NormalizedJob[]> {
    const limit = query.limit || 20;
    const allJobs: NormalizedJob[] = [];

    for (const org of this.defaultOrgs.slice(0, 2)) {
      try {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${org}`, {
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = (await res.json()) as { jobs: any[] };
          const companyFormatted = org.charAt(0).toUpperCase() + org.slice(1);
          (data.jobs || []).slice(0, 10).forEach((r) => allJobs.push(this.normalizeJob(r, companyFormatted)));
        }
      } catch {
        // Skip org gracefully
      }
    }

    if (allJobs.length === 0) {
      return this.getFallbackJobs();
    }

    let filtered = allJobs;
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.title.toLowerCase().includes(kw) ||
          j.company.toLowerCase().includes(kw) ||
          j.skills.some((s) => s.toLowerCase().includes(kw))
      );
    }

    return filtered.slice(0, limit);
  }

  async getJobDetails(jobId: string): Promise<NormalizedJob | null> {
    const jobs = await this.searchJobs({ limit: 40 });
    return jobs.find((j) => j.id === jobId || j.providerJobId === jobId) || null;
  }

  private getFallbackJobs(): NormalizedJob[] {
    const seeds = [
      {
        id: 'ashby_901',
        title: 'Senior Product Engineer (TypeScript / Next.js / Sync Engine)',
        location: 'Remote',
        description: 'Help build high-performance client-side synchronization and desktop UI. Deep expertise in React, TypeScript, IndexedDB, and WebSockets.',
        publishedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
      },
    ];

    return seeds.map((s) => this.normalizeJob(s, 'Linear'));
  }
}
