import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma, OutboxStatus } from '@careergraph/db';
import { jobService } from '../services/jobs/jobService.js';
import { extractSkillsFromText, extractStructuredRequirements, generateJobFingerprint } from '../services/jobs/skillExtractor.js';

const app = createApp();

describe('CareerGraph Phase 4: Job Discovery Engine', () => {
  const testUserEmail = `candidate_jobs_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  let token: string;
  let userId: string;

  beforeAll(async () => {
    // 1. Create authenticated user
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Jordan JobHunter',
      email: testUserEmail,
      password,
    });
    expect(regRes.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
    userId = user!.id;
    await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });

    // Initialize profile with preferences for auto-generating saved searches
    await prisma.candidateProfile.create({
      data: {
        userId,
        fullName: 'Jordan JobHunter',
        headline: 'Staff Distributed Systems Engineer',
        preferences: {
          create: {
            targetTitles: ['Distributed Systems Engineer', 'Full Stack Engineer'],
            targetLocations: ['Remote', 'San Francisco, CA'],
            remotePreference: 'REMOTE_FIRST',
            minSalary: 150000,
          },
        },
      },
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUserEmail,
      password,
    });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup database
    await prisma.savedSearch.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email: testUserEmail } });
    await prisma.$disconnect();
  });

  it('1. Extracts canonical skills, experience requirements, and generates immutable fingerprints', () => {
    const title = 'Lead Backend Engineer (Go / Kubernetes)';
    const description = `We are seeking an engineer with 5+ years of experience with Golang, Kubernetes, Docker, and Kafka.
Must be authorized to work in the US without visa sponsorship. Degree in Computer Science preferred.`;

    const skills = extractSkillsFromText(`${title} ${description}`);
    expect(skills).toContain('Go');
    expect(skills).toContain('Kubernetes');
    expect(skills).toContain('Docker');
    expect(skills).toContain('Kafka');

    const requirements = extractStructuredRequirements(title, description);
    expect(requirements.length).toBeGreaterThanOrEqual(3);

    // Hard constraint verification
    const workAuthReq = requirements.find((r) => r.category === 'WORK_AUTH');
    expect(workAuthReq).toBeDefined();
    expect(workAuthReq?.isHardConstraint).toBe(true);

    // Fingerprint verification
    const fp1 = generateJobFingerprint('Stripe', 'Staff Engineer', 'Remote');
    const fp2 = generateJobFingerprint('stripe ', 'staff engineer', 'remote');
    expect(fp1).toBe(fp2); // Case and whitespace invariant
  });

  it('2. GET /api/v1/jobs/sources returns registry of 5 adapters with health and capabilities', async () => {
    const res = await request(app)
      .get('/api/v1/jobs/sources')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sources).toBeInstanceOf(Array);
    expect(res.body.sources.length).toBe(5);

    const providers = res.body.sources.map((s: any) => s.provider);
    expect(providers).toContain('REMOTIVE');
    expect(providers).toContain('GREENHOUSE');
    expect(providers).toContain('LEVER');
    expect(providers).toContain('ADZUNA');
    expect(providers).toContain('ASHBY');

    // Verify Remotive capabilities
    const remotive = res.body.sources.find((s: any) => s.provider === 'REMOTIVE');
    expect(remotive.capabilities.supportsKeywordSearch).toBe(true);
    expect(remotive.capabilities.rateLimit).toBeDefined();
  });

  it('3. POST /api/v1/jobs/discover executes discovery cycle and persists normalized jobs', async () => {
    const res = await request(app)
      .post('/api/v1/jobs/discover')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sources: ['REMOTIVE'],
        limit: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body.totalIngested).toBeGreaterThanOrEqual(1);

    // Verify OutboxEvent was emitted for graph synchronization
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { eventType: 'JOB_INGESTED' },
    });
    expect(outboxEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('4. Multi-tier deduplication prevents duplicate records on repeated ingestion', async () => {
    const runId = Date.now();
    const testCompany = `Acme Robotics ${runId}`;
    const testTitle = `Senior Systems Architect ${runId}`;

    const testNormalized = {
      id: `test_dedup_${runId}`,
      provider: 'REMOTIVE' as const,
      providerJobId: `test_prov_${runId}`,
      company: testCompany,
      title: testTitle,
      description: 'Design real-time robotic systems using C++, Rust, and Linux.',
      jobUrl: `https://example.com/jobs/acme-${runId}`,
      location: 'Remote',
      remoteType: 'REMOTE' as const,
      employmentType: 'Full-time',
      seniority: 'SENIOR' as const,
      minSalary: 160000,
      maxSalary: 210000,
      currency: 'USD',
      skills: ['Rust', 'C++', 'Linux'],
      qualifications: ['BSc in Engineering'],
      status: 'OPEN' as const,
      fingerprint: generateJobFingerprint(testCompany, testTitle, 'Remote'),
      requirements: [
        { description: 'Hands-on Rust programming', skill: 'Rust', isHardConstraint: true, weight: 1.5 },
      ],
    };

    // First ingestion -> new record
    const firstIngest = await jobService.ingestJob(testNormalized, userId);
    expect(firstIngest.isNew).toBe(true);
    const originalId = firstIngest.job.id;

    // Second ingestion with same fingerprint -> updates existing record
    const secondIngest = await jobService.ingestJob(testNormalized, userId);
    expect(secondIngest.isNew).toBe(false);
    expect(secondIngest.job.id).toBe(originalId);
  });

  it('5. GET /api/v1/jobs supports faceted search, filtering, and pagination', async () => {
    const res = await request(app)
      .get('/api/v1/jobs?remoteType=REMOTE&page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.page).toBe(1);

    const first = res.body.jobs[0];
    expect(first.title).toBeDefined();
    expect(first.company).toBeDefined();
    expect(first.requirements).toBeInstanceOf(Array);
  });

  it('6. POST /api/v1/jobs/import-url imports direct job URL with custom title/description', async () => {
    const importRes = await request(app)
      .post('/api/v1/jobs/import-url')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: 'https://careers.exampletech.com/jobs/senior-dev-123',
        company: 'ExampleTech Labs',
        title: 'Senior Full Stack Platform Engineer',
        description: 'Building microservices with TypeScript, Node.js, and PostgreSQL. Must have 4+ years of experience with React.',
        location: 'Remote, US',
        remoteType: 'REMOTE',
        minSalary: 145000,
        maxSalary: 180000,
      });

    expect(importRes.status).toBe(201);
    expect(importRes.body.job).toBeDefined();
    expect(importRes.body.job.company).toBe('ExampleTech Labs');
    expect(importRes.body.job.requirements.length).toBeGreaterThanOrEqual(1);
  });

  it('7. Enforces ethical scraping compliance: rejects automated scraping on prohibited domains', async () => {
    const badRes = await request(app)
      .post('/api/v1/jobs/import-url')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: 'https://www.linkedin.com/jobs/view/1234567890',
        // Omitting title and description to trigger automated scraper check
      });

    expect(badRes.status).toBe(400);
    expect(badRes.body.code).toBe('IMPORT_ERROR');
    expect(badRes.body.message).toContain('restricted by its Terms of Service');
  });

  it('8. POST /api/v1/jobs/:id/verify-freshness re-verifies listing status', async () => {
    const jobsList = await request(app)
      .get('/api/v1/jobs?limit=1')
      .set('Authorization', `Bearer ${token}`);
    const jobId = jobsList.body.jobs[0].id;

    const freshRes = await request(app)
      .post(`/api/v1/jobs/${jobId}/verify-freshness`)
      .set('Authorization', `Bearer ${token}`);

    expect(freshRes.status).toBe(200);
    expect(freshRes.body.status).toBeDefined();
  });

  it('9. Saved Searches CRUD & Auto-generation from profile preferences', async () => {
    // 1. Auto-generate from profile
    const autoRes = await request(app)
      .post('/api/v1/jobs/saved-searches/auto-generate')
      .set('Authorization', `Bearer ${token}`);
    expect(autoRes.status).toBe(200);
    expect(autoRes.body.savedSearches.length).toBeGreaterThanOrEqual(1);

    // 2. Create explicit saved search
    const createRes = await request(app)
      .post('/api/v1/jobs/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Golang Microservices Remote',
        keywords: 'Golang',
        location: 'Remote',
        remoteOnly: true,
        minSalary: 140000,
        frequency: 'DAILY',
        isActive: true,
      });
    expect(createRes.status).toBe(201);
    const searchId = createRes.body.savedSearch.id;

    // 3. List saved searches
    const listRes = await request(app)
      .get('/api/v1/jobs/saved-searches')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.savedSearches.some((s: any) => s.id === searchId)).toBe(true);

    // 4. Delete saved search
    const delRes = await request(app)
      .delete(`/api/v1/jobs/saved-searches/${searchId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
  });
});
