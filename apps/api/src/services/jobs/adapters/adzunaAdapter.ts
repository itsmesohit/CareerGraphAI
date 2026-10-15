import type {
  JobSource,
  JobSearchQuery,
  NormalizedJob,
  JobSourceCapabilities,
} from '@careergraph/shared';
import { extractSkillsFromText, extractStructuredRequirements, generateJobFingerprint } from '../skillExtractor.js';

export class AdzunaAdapter implements JobSource {
  public readonly name = 'ADZUNA' as const;

  private readonly appId = process.env.ADZUNA_APP_ID;
  private readonly appKey = process.env.ADZUNA_APP_KEY;
  private readonly country = process.env.ADZUNA_COUNTRY || 'in'; // Defaults to India, supports 'us', 'gb'

  getCapabilities(): JobSourceCapabilities {
    const isConfigured = Boolean(this.appId && this.appKey);
    return {
      supportsKeywordSearch: true,
      supportsCategoryFilter: true,
      supportsLocationFilter: true,
      supportsDirectApplication: false,
      rateLimit: isConfigured
        ? 'Active registered credentials. 250 requests/day on standard tier.'
        : 'Requires ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.',
      attributionRequired: true,
      notes: isConfigured
        ? 'Live job aggregation across millions of openings (supporting India, US, UK).'
        : 'Adzuna adapter is standby (pending API key configuration). Free sign-up at developer.adzuna.com.',
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.appId || !this.appKey) {
      return false;
    }
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/${this.country}/search/1?app_id=${this.appId}&app_key=${this.appKey}&results_per_page=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  normalizeJob(raw: any): NormalizedJob {
    const title = raw.title || 'Tech Opportunity';
    const company = raw.company?.display_name || 'Technology Enterprise';
    const description = (raw.description || title)
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const location = raw.location?.display_name || 'Bangalore, India / Remote';
    const skills = extractSkillsFromText(`${title} ${description}`);
    const requirements = extractStructuredRequirements(title, description);

    return {
      id: `adzuna_${raw.id}`,
      provider: 'ADZUNA',
      providerJobId: String(raw.id),
      title,
      company,
      description,
      jobUrl: raw.redirect_url || `https://www.adzuna.in/jobs/details/${raw.id}`,
      applyUrl: raw.redirect_url || null,
      location,
      country: this.country.toUpperCase(),
      remoteType: (raw.description || '').toLowerCase().includes('remote') ? 'REMOTE' : 'HYBRID',
      employmentType: 'Full-time',
      seniority: title.toLowerCase().includes('senior') ? 'SENIOR' : 'MID',
      minSalary: raw.salary_min ? Math.round(raw.salary_min) : undefined,
      maxSalary: raw.salary_max ? Math.round(raw.salary_max) : undefined,
      currency: this.country === 'in' ? 'INR' : 'USD',
      skills,
      qualifications: requirements.filter(r => r.category === 'EDUCATION' || r.category === 'WORK_AUTH').map(r => r.description),
      status: 'OPEN',
      postedAt: raw.created || new Date().toISOString(),
      attribution: 'Powered by Adzuna API',
      fingerprint: generateJobFingerprint(company, title, location),
      requirements,
      rawPayload: {
        category: raw.category,
        contract_type: raw.contract_type,
      },
    };
  }

  async searchJobs(query: JobSearchQuery): Promise<NormalizedJob[]> {
    if (!this.appId || !this.appKey) {
      // Gracefully returns empty without crashing when unconfigured
      return [];
    }

    try {
      const page = query.page || 1;
      const limit = query.limit || 15;
      const what = encodeURIComponent(query.keywords || 'software developer');
      const url = `https://api.adzuna.com/v1/api/jobs/${this.country}/search/${page}?app_id=${this.appId}&app_key=${this.appKey}&results_per_page=${limit}&what=${what}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Adzuna API returned ${res.status}`);

      const data = (await res.json()) as { results: any[] };
      const rawResults = data.results || [];
      return rawResults.map((r) => this.normalizeJob(r));
    } catch (err: any) {
      console.warn(`[AdzunaAdapter] Search failed: ${err.message}`);
      return [];
    }
  }

  async getJobDetails(_id: string): Promise<NormalizedJob | null> {
    return null;
  }
}
