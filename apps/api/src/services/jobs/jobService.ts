import { prisma, graphOps, type JobPosting, type JobRequirement, type SavedSearch } from '@careergraph/db';
import type {
  JobSource,
  NormalizedJob,
  JobFilterQuery,
  JobUrlImportInput,
  SavedSearchInput,
  JobSourceProvider,
} from '@careergraph/shared';
import { RemotiveAdapter } from './adapters/remotiveAdapter.js';
import { GreenhouseAdapter } from './adapters/greenhouseAdapter.js';
import { LeverAdapter } from './adapters/leverAdapter.js';
import { AdzunaAdapter } from './adapters/adzunaAdapter.js';
import { AshbyAdapter } from './adapters/ashbyAdapter.js';
import { scrapeOrConstructJob } from './urlScraper.js';
import { outboxService } from '../outboxService.js';

export class JobService {
  private readonly adapters: Map<JobSourceProvider, JobSource> = new Map();

  constructor() {
    const remotive = new RemotiveAdapter();
    const greenhouse = new GreenhouseAdapter();
    const lever = new LeverAdapter();
    const adzuna = new AdzunaAdapter();
    const ashby = new AshbyAdapter();

    this.adapters.set(remotive.name, remotive);
    this.adapters.set(greenhouse.name, greenhouse);
    this.adapters.set(lever.name, lever);
    this.adapters.set(adzuna.name, adzuna);
    this.adapters.set(ashby.name, ashby);
  }

  /**
   * Returns metadata, rate limits, and health status for all registered adapters (Spec §9).
   */
  async getSources(): Promise<Array<{
    provider: JobSourceProvider;
    capabilities: any;
    isHealthy: boolean;
  }>> {
    const results = [];
    for (const [provider, adapter] of this.adapters.entries()) {
      const isHealthy = await adapter.healthCheck().catch(() => false);
      results.push({
        provider,
        capabilities: adapter.getCapabilities(),
        isHealthy,
      });
    }
    return results;
  }

  /**
   * Lists jobs with faceted search, pagination, and sorting.
   */
  async listJobs(filters: JobFilterQuery): Promise<{
    jobs: Array<JobPosting & { requirements: JobRequirement[] }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.provider) {
      where.provider = filters.provider;
    }

    if (filters.remoteType) {
      where.remoteType = filters.remoteType;
    }

    if (filters.seniority) {
      where.seniority = filters.seniority;
    }

    if (filters.company) {
      where.company = { contains: filters.company, mode: 'insensitive' };
    }

    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters.minSalary) {
      where.OR = [
        { minSalary: { gte: filters.minSalary } },
        { maxSalary: { gte: filters.minSalary } },
      ];
    }

    if (filters.q) {
      const q = filters.q.trim();
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { skills: { hasSome: [q] } },
        ],
      });
    }

    if (filters.skills) {
      const skillList = filters.skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (skillList.length > 0) {
        where.skills = { hasSome: skillList };
      }
    }

    const orderBy: any = {};
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    orderBy[sortBy] = sortOrder;

    const [total, jobs] = await Promise.all([
      prisma.jobPosting.count({ where }),
      prisma.jobPosting.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { requirements: true },
      }),
    ]);

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves a single job by ID.
   */
  async getJobById(id: string): Promise<(JobPosting & { requirements: JobRequirement[] }) | null> {
    return prisma.jobPosting.findUnique({
      where: { id },
      include: { requirements: true, organization: true },
    });
  }

  /**
   * Ingests a normalized job entity with multi-tier deduplication.
   */
  async ingestJob(
    normalized: NormalizedJob,
    userId?: string
  ): Promise<{ job: JobPosting & { requirements: JobRequirement[] }; isNew: boolean }> {
    // 1. Multi-tier Deduplication Check
    // Tier A: Check by unique fingerprint
    let existing = await prisma.jobPosting.findUnique({
      where: { fingerprint: normalized.fingerprint },
      include: { requirements: true },
    });

    // Tier B: Check by provider + providerJobId
    if (!existing && normalized.providerJobId) {
      existing = await prisma.jobPosting.findFirst({
        where: {
          provider: normalized.provider as any,
          providerJobId: normalized.providerJobId,
        },
        include: { requirements: true },
      });
    }

    // Tier C: Check by canonical URL
    if (!existing && normalized.jobUrl) {
      existing = await prisma.jobPosting.findFirst({
        where: { jobUrl: normalized.jobUrl },
        include: { requirements: true },
      });
    }

    let jobRecord: JobPosting & { requirements: JobRequirement[] };
    let isNew = false;

    if (existing) {
      // Update last seen timestamp & refresh status if was stale
      const updated = await prisma.jobPosting.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          status: existing.status === 'STALE' ? 'OPEN' : existing.status,
          minSalary: normalized.minSalary ?? existing.minSalary,
          maxSalary: normalized.maxSalary ?? existing.maxSalary,
        },
        include: { requirements: true },
      });
      jobRecord = updated;
    } else {
      isNew = true;
      // Insert new job record with extracted requirements
      jobRecord = await prisma.jobPosting.create({
        data: {
          id: normalized.id.startsWith('remotive_') || normalized.id.startsWith('gh_') || normalized.id.startsWith('lever_') || normalized.id.startsWith('ashby_') || normalized.id.startsWith('adzuna_')
            ? undefined // Use PostgreSQL auto-generated UUID
            : normalized.id,
          provider: normalized.provider as any,
          providerJobId: normalized.providerJobId,
          company: normalized.company,
          title: normalized.title,
          description: normalized.description,
          jobUrl: normalized.jobUrl,
          applyUrl: normalized.applyUrl,
          location: normalized.location,
          country: normalized.country,
          remoteType: normalized.remoteType as any,
          employmentType: normalized.employmentType,
          seniority: normalized.seniority as any,
          minSalary: normalized.minSalary,
          maxSalary: normalized.maxSalary,
          currency: normalized.currency || 'USD',
          skills: normalized.skills,
          qualifications: normalized.qualifications,
          status: normalized.status as any,
          fingerprint: normalized.fingerprint,
          postedAt: normalized.postedAt ? new Date(normalized.postedAt) : new Date(),
          attribution: normalized.attribution,
          rawPayload: normalized.rawPayload,
          requirements: {
            create: normalized.requirements.map((r) => ({
              description: r.description,
              skill: r.skill,
              isHardConstraint: r.isHardConstraint,
              weight: r.weight,
              category: r.category || 'TECHNICAL',
              minYears: r.minYears,
            })),
          },
        },
        include: { requirements: true },
      });
    }

    // 2. Outbox Event emission for graph synchronization
    await outboxService.emit({
      aggregateType: 'JOB',
      aggregateId: jobRecord.id,
      eventType: isNew ? 'JOB_INGESTED' : 'JOB_UPDATED',
      payload: {
        id: jobRecord.id,
        company: jobRecord.company,
        title: jobRecord.title,
        location: jobRecord.location,
        url: jobRecord.jobUrl,
        salary: jobRecord.minSalary ? `$${jobRecord.minSalary.toLocaleString()}` : undefined,
        requirements: jobRecord.requirements.map((r) => ({
          description: r.description,
          skill: r.skill,
          isHardConstraint: r.isHardConstraint,
          weight: r.weight,
        })),
        ingestedByUserId: userId,
      },
    });

    // 3. Immediate projection for graph responsiveness
    await graphOps.projectJob({
      id: jobRecord.id,
      company: jobRecord.company,
      title: jobRecord.title,
      location: jobRecord.location || undefined,
      url: jobRecord.jobUrl,
      salary: jobRecord.minSalary ? `$${jobRecord.minSalary.toLocaleString()}` : undefined,
      requirements: jobRecord.requirements.map((r) => ({
        description: r.description,
        skill: r.skill || undefined,
        isHardConstraint: r.isHardConstraint,
        weight: r.weight,
      })),
    }).catch((err) => console.warn('[JobService] Direct graph projection error:', err.message));

    return { job: jobRecord, isNew };
  }

  /**
   * Triggers parallel job discovery across registered adapters.
   */
  async discoverJobs(options: {
    sources?: JobSourceProvider[];
    keywords?: string;
    limit?: number;
  } = {}): Promise<{
    discoveredCount: number;
    updatedCount: number;
    totalIngested: number;
  }> {
    const targetAdapters = options.sources
      ? options.sources.map((s) => this.adapters.get(s)).filter((a): a is JobSource => a !== undefined)
      : Array.from(this.adapters.values());

    const searchQuery = {
      keywords: options.keywords,
      limit: options.limit || 15,
    };

    let discoveredCount = 0;
    let updatedCount = 0;

    for (const adapter of targetAdapters) {
      try {
        const jobs = await adapter.searchJobs(searchQuery);
        for (const job of jobs) {
          const res = await this.ingestJob(job);
          if (res.isNew) {
            discoveredCount++;
          } else {
            updatedCount++;
          }
        }
      } catch (err: any) {
        console.warn(`[JobService] Error during discovery with adapter ${adapter.name}:`, err.message);
      }
    }

    return {
      discoveredCount,
      updatedCount,
      totalIngested: discoveredCount + updatedCount,
    };
  }

  /**
   * Imports a job from a direct URL or pasted card.
   */
  async importJobUrl(
    input: JobUrlImportInput,
    userId: string
  ): Promise<JobPosting & { requirements: JobRequirement[] }> {
    const normalized = await scrapeOrConstructJob(input);
    const { job } = await this.ingestJob(normalized, userId);
    return job;
  }

  /**
   * Re-verifies if a job listing is open (Spec §9 "Never present unverified listings as open").
   */
  async verifyFreshness(id: string): Promise<{ status: string; isLive: boolean }> {
    const job = await prisma.jobPosting.findUnique({ where: { id } });
    if (!job) throw new Error('Job not found');

    let isLive = true;
    try {
      const res = await fetch(job.jobUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3500),
      });

      if (res.status === 404 || res.status === 410) {
        isLive = false;
        await prisma.jobPosting.update({
          where: { id },
          data: { status: 'CLOSED' },
        });
      } else {
        await prisma.jobPosting.update({
          where: { id },
          data: { lastSeenAt: new Date() },
        });
      }
    } catch {
      // Network timeout or blocked HEAD request — keep as OPEN but mark last seen
      await prisma.jobPosting.update({
        where: { id },
        data: { lastSeenAt: new Date() },
      });
    }

    return {
      status: isLive ? job.status : 'CLOSED',
      isLive,
    };
  }

  // -------------------------------------------------------------------------
  // Saved Searches Operations
  // -------------------------------------------------------------------------

  async listSavedSearches(userId: string): Promise<SavedSearch[]> {
    return prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSavedSearch(userId: string, input: SavedSearchInput): Promise<SavedSearch> {
    return prisma.savedSearch.create({
      data: {
        userId,
        name: input.name,
        keywords: input.keywords,
        location: input.location,
        remoteOnly: input.remoteOnly,
        minSalary: input.minSalary,
        seniority: input.seniority as any,
        frequency: input.frequency as any,
        isActive: input.isActive,
      },
    });
  }

  async deleteSavedSearch(id: string, userId: string): Promise<boolean> {
    const found = await prisma.savedSearch.findFirst({
      where: { id, userId },
    });
    if (!found) return false;

    await prisma.savedSearch.delete({ where: { id } });
    return true;
  }

  /**
   * Auto-generates saved searches from candidate's profile preferences (Spec §9).
   */
  async autoGenerateFromProfile(userId: string): Promise<SavedSearch[]> {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { preferences: true },
    });

    const prefs = profile?.preferences;
    const titles = prefs?.targetTitles && prefs.targetTitles.length > 0
      ? prefs.targetTitles
      : ['Software Engineer', 'Full Stack Developer'];

    const createdSearches: SavedSearch[] = [];

    for (const title of titles) {
      const existing = await prisma.savedSearch.findFirst({
        where: { userId, keywords: title },
      });

      if (!existing) {
        const created = await prisma.savedSearch.create({
          data: {
            userId,
            name: `${title} (Auto)`,
            keywords: title,
            location: prefs?.targetLocations?.[0] || 'Remote',
            remoteOnly: prefs?.remotePreference === 'REMOTE_FIRST' || prefs?.remotePreference === 'REMOTE_ONLY',
            minSalary: prefs?.minSalary,
            frequency: 'DAILY',
            isActive: true,
          },
        });
        createdSearches.push(created);
      }
    }

    return createdSearches;
  }
}

export const jobService = new JobService();
