import type {
  JobSource,
  JobSearchQuery,
  NormalizedJob,
  JobSourceCapabilities,
} from '@careergraph/shared';
import { extractSkillsFromText, extractStructuredRequirements, generateJobFingerprint } from '../skillExtractor.js';

export class RemotiveAdapter implements JobSource {
  public readonly name = 'REMOTIVE' as const;

  getCapabilities(): JobSourceCapabilities {
    return {
      supportsKeywordSearch: true,
      supportsCategoryFilter: true,
      supportsLocationFilter: true,
      supportsDirectApplication: false,
      rateLimit: 'Public API, 1 request per second recommended',
      attributionRequired: true,
      notes: 'Remotive provides high quality verified remote technology jobs worldwide.',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://remotive.com/api/remote-jobs?limit=1', {
        signal: AbortSignal.timeout(3500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  normalizeJob(raw: any): NormalizedJob {
    const title = raw.title || 'Software Engineer';
    const company = raw.company_name || 'Tech Company';
    const description = (raw.description || title).replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    const location = raw.candidate_required_location || 'Worldwide Remote';
    const skills = extractSkillsFromText(`${title} ${description} ${(raw.tags || []).join(' ')}`);
    const requirements = extractStructuredRequirements(title, description);

    // Parse salary if provided, e.g. "$120,000 - $160,000" or raw string
    let minSalary: number | undefined;
    let maxSalary: number | undefined;
    if (raw.salary) {
      const nums = (raw.salary.match(/\d+[\d,]*/g) || []).map((n: string) => parseInt(n.replace(/,/g, ''), 10));
      if (nums.length >= 2) {
        minSalary = Math.min(nums[0], nums[1]);
        maxSalary = Math.max(nums[0], nums[1]);
      } else if (nums.length === 1) {
        minSalary = nums[0];
      }
    }

    return {
      id: `remotive_${raw.id}`,
      provider: 'REMOTIVE',
      providerJobId: String(raw.id),
      title,
      company,
      description,
      jobUrl: raw.url || `https://remotive.com/remote-jobs/software-dev/${raw.id}`,
      applyUrl: raw.url || null,
      location,
      country: location.includes('USA') ? 'USA' : undefined,
      remoteType: 'REMOTE',
      employmentType: raw.job_type === 'contract' ? 'Contract' : 'Full-time',
      seniority: title.toLowerCase().includes('senior') ? 'SENIOR' : title.toLowerCase().includes('lead') ? 'LEAD' : title.toLowerCase().includes('principal') ? 'LEAD' : 'MID',
      minSalary,
      maxSalary,
      currency: 'USD',
      skills,
      qualifications: requirements.filter(r => r.category === 'EDUCATION' || r.category === 'WORK_AUTH').map(r => r.description),
      status: 'OPEN',
      postedAt: raw.publication_date || new Date().toISOString(),
      attribution: 'Powered by Remotive API',
      fingerprint: generateJobFingerprint(company, title, location),
      requirements,
      rawPayload: {
        category: raw.category,
        tags: raw.tags,
      },
    };
  }

  async searchJobs(query: JobSearchQuery): Promise<NormalizedJob[]> {
    try {
      const category = query.category || 'software-dev';
      const limit = query.limit || 20;
      let url = `https://remotive.com/api/remote-jobs?category=${encodeURIComponent(category)}&limit=${limit}`;
      if (query.keywords) {
        url += `&search=${encodeURIComponent(query.keywords)}`;
      }

      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Remotive API responded with status ${res.status}`);

      const data = (await res.json()) as { jobs: any[] };
      const rawJobs = data.jobs || [];

      let normalized = rawJobs.map((r) => this.normalizeJob(r));
      if (query.keywords) {
        const kw = query.keywords.toLowerCase();
        normalized = normalized.filter(
          (j) =>
            j.title.toLowerCase().includes(kw) ||
            j.description.toLowerCase().includes(kw) ||
            j.skills.some((s) => s.toLowerCase().includes(kw))
        );
      }
      return normalized.slice(0, limit);
    } catch (err: any) {
      console.warn(`[RemotiveAdapter] Live fetch failed (${err.message}). Using fallback seed postings.`);
      return this.getFallbackJobs();
    }
  }

  async getJobDetails(jobId: string): Promise<NormalizedJob | null> {
    const jobs = await this.searchJobs({ limit: 40 });
    return jobs.find((j) => j.id === jobId || j.providerJobId === jobId) || null;
  }

  private getFallbackJobs(): NormalizedJob[] {
    const seeds = [
      {
        id: 101,
        title: 'Senior Full Stack Engineer (TypeScript, Node.js, React)',
        company_name: 'Remote First Tech',
        description: 'Join our distributed engineering team building collaborative productivity tools. Requirements: 5+ years of experience with TypeScript, React, Node.js, PostgreSQL, and Redis caching. Must be authorized to work globally.',
        candidate_required_location: 'Worldwide Remote',
        publication_date: new Date(Date.now() - 3600000 * 4).toISOString(),
        salary: '$130,000 - $170,000 USD',
        tags: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      },
      {
        id: 102,
        title: 'Distributed Systems & Backend Engineer',
        company_name: 'CloudScale Labs',
        description: 'Seeking a backend engineer to design scalable event-driven architectures. Must have hands-on experience in Golang, Kubernetes, Kafka, and Redis. Degree in Computer Science or equivalent.',
        candidate_required_location: 'USA / Europe / Remote',
        publication_date: new Date(Date.now() - 3600000 * 12).toISOString(),
        salary: '$140,000 - $190,000 USD',
        tags: ['Go', 'Kubernetes', 'Kafka', 'Redis'],
      },
    ];

    return seeds.map((s) => this.normalizeJob(s));
  }
}
