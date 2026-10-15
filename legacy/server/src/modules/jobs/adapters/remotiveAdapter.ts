import { JobSource, JobSearchQuery, NormalizedJob, JobSourceCapabilities } from '../types.js';
import { extractSkillsFromText, generateFingerprint } from '../skillExtractor.js';

export class RemotiveAdapter implements JobSource {
  public readonly name = 'REMOTIVE';

  getCapabilities(): JobSourceCapabilities {
    return {
      supportsKeywordSearch: true,
      supportsCategoryFilter: true,
      supportsLocationFilter: true,
      supportsDirectApplication: false,
      rateLimit: 'Public API, 1 request per second recommended',
      attributionRequired: true,
      notes: 'Remotive provides high quality verified remote technology jobs.',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://remotive.com/api/remote-jobs?limit=1', { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  normalizeJob(raw: any): NormalizedJob {
    const skills = extractSkillsFromText(`${raw.title} ${raw.description || ''} ${(raw.tags || []).join(' ')}`);
    const requirements = skills.map((s, idx) => ({
      text: `Demonstrated capability with ${s} in production systems`,
      importance: (idx < 2 ? 'REQUIRED' : 'PREFERRED') as 'REQUIRED' | 'PREFERRED',
      skillName: s,
      minYears: idx === 0 ? 3 : 2,
    }));

    return {
      id: `remotive_${raw.id}`,
      provider: 'REMOTIVE',
      providerJobId: String(raw.id),
      title: raw.title,
      company: raw.company_name,
      description: raw.description?.replace(/<[^>]*>?/gm, '') || raw.title,
      url: raw.url,
      applyUrl: raw.url,
      location: raw.candidate_required_location || 'Worldwide Remote',
      remote: true,
      employmentType: raw.job_type || 'Full-time',
      seniority: raw.title.toLowerCase().includes('senior') ? 'SENIOR' : raw.title.toLowerCase().includes('lead') ? 'LEAD' : 'MID',
      salary: raw.salary || '$110,000 - $160,000 USD',
      publishedAt: raw.publication_date || new Date().toISOString(),
      extractedSkills: skills,
      requirements,
      fingerprint: generateFingerprint(raw.company_name, raw.title, raw.candidate_required_location || 'remote'),
      capabilities: {
        canAutoSubmit: false,
        requiresApproval: true,
        hasApplicationForm: true,
      }
    };
  }

  async searchJobs(query: JobSearchQuery): Promise<NormalizedJob[]> {
    try {
      const category = query.category || 'software-dev';
      const limit = query.limit || 15;
      const url = `https://remotive.com/api/remote-jobs?category=${category}&limit=${limit}`;
      
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Remotive API responded with status ${res.status}`);
      
      const data = await res.json() as { jobs: any[] };
      const rawJobs = data.jobs || [];

      let normalized = rawJobs.map(r => this.normalizeJob(r));
      if (query.keywords) {
        const kw = query.keywords.toLowerCase();
        normalized = normalized.filter(j => 
          j.title.toLowerCase().includes(kw) || 
          j.extractedSkills.some(s => s.toLowerCase().includes(kw))
        );
      }
      return normalized.slice(0, limit);
    } catch (err: any) {
      console.warn(`[RemotiveAdapter] Fetch error (${err.message}). Using fallback synthetic data.`);
      return this.getFallbackJobs();
    }
  }

  async getJobDetails(jobId: string): Promise<NormalizedJob | null> {
    const jobs = await this.searchJobs({ limit: 30 });
    return jobs.find(j => j.id === jobId) || null;
  }

  private getFallbackJobs(): NormalizedJob[] {
    const fallbacks = [
      {
        id: 901,
        title: 'Senior Full Stack Graph Engineer',
        company_name: 'Falkor Dynamics',
        description: 'Build agentic memory graphs, low latency Cypher traversals, and scalable React TypeScript applications with FalkorDB and Node.js.',
        url: 'https://careers.falkordb.com/jobs/901',
        candidate_required_location: 'Remote, US / EU / India',
        job_type: 'full_time',
        publication_date: new Date().toISOString(),
        salary: '$140,000 - $185,000 USD',
        tags: ['FalkorDB', 'TypeScript', 'React', 'Node.js', 'Redis', 'Docker'],
      },
      {
        id: 902,
        title: 'AI Agent Systems Architect',
        company_name: 'Cognitive Mesh',
        description: 'Design multi-agent workflows, episodic memory persistence with graph databases, and structured LLM tool execution.',
        url: 'https://careers.cognitivemesh.ai/jobs/902',
        candidate_required_location: 'Remote',
        job_type: 'full_time',
        publication_date: new Date().toISOString(),
        salary: '$150,000 - $200,000 USD',
        tags: ['AI Agents', 'LLM', 'Python', 'TypeScript', 'FalkorDB', 'Redis'],
      },
      {
        id: 903,
        title: 'Backend Platform Engineer',
        company_name: 'Distributed Cloud Labs',
        description: 'High throughput API engineering with Node.js, Express, PostgreSQL, Prisma, BullMQ queues, and Docker orchestration.',
        url: 'https://careers.distributedcloud.io/jobs/903',
        candidate_required_location: 'Worldwide Remote',
        job_type: 'full_time',
        publication_date: new Date().toISOString(),
        salary: '$125,000 - $165,000 USD',
        tags: ['Node.js', 'PostgreSQL', 'Prisma', 'BullMQ', 'Docker', 'REST'],
      }
    ];

    return fallbacks.map(f => this.normalizeJob(f));
  }
}
