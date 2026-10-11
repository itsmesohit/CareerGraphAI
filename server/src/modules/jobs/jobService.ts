import { JobSource, JobSearchQuery, NormalizedJob } from './types.js';
import { RemotiveAdapter } from './adapters/remotiveAdapter.js';
import { GreenhouseAdapter } from './adapters/greenhouseAdapter.js';
import { LeverAdapter } from './adapters/additionalAdapters.js';
import { FalkorGraphService } from '../../db/falkor/queries.js';

export class JobDiscoveryEngine {
  private sources: JobSource[] = [
    new RemotiveAdapter(),
    new GreenhouseAdapter(),
    new LeverAdapter(),
  ];

  // In-memory cache of discovered jobs for fast retrieval & detail inspection
  private static cachedJobs: Map<string, NormalizedJob> = new Map();

  async discoverJobs(tenantId: string, query: JobSearchQuery = {}): Promise<NormalizedJob[]> {
    const allFound: NormalizedJob[] = [];
    const seenFingerprints = new Set<string>();

    for (const source of this.sources) {
      try {
        const jobs = await source.searchJobs(query);
        for (const job of jobs) {
          if (!seenFingerprints.has(job.fingerprint)) {
            seenFingerprints.add(job.fingerprint);
            allFound.push(job);
            JobDiscoveryEngine.cachedJobs.set(job.id, job);

            // Ingest to FalkorDB for candidate's tenant
            await FalkorGraphService.upsertJob(tenantId, {
              id: job.id,
              externalId: job.providerJobId,
              source: job.provider,
              title: job.title,
              company: job.company,
              location: job.location,
              remote: job.remote,
              url: job.url,
              applyUrl: job.applyUrl,
              salary: job.salary,
              description: job.description,
              seniority: job.seniority,
              requirements: job.requirements,
            });
          }
        }
      } catch (err: any) {
        console.error(`[JobDiscoveryEngine] Error fetching from source ${source.name}:`, err.message);
      }
    }

    return allFound;
  }

  static getJobById(id: string): NormalizedJob | undefined {
    return this.cachedJobs.get(id);
  }

  static getCachedJobs(): NormalizedJob[] {
    return Array.from(this.cachedJobs.values());
  }
}

export const jobDiscoveryEngine = new JobDiscoveryEngine();
