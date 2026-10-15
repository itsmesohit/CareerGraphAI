import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';
import { generateJobFingerprint } from '../services/jobs/skillExtractor.js';

const app = createApp();

describe('CareerGraph Phase 6: Application Lifecycle & Agent Orchestration (Spec §12, §13, §14, §15)', () => {
  const testUserEmail = `candidate_lifecycle_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  let token: string;
  let userId: string;
  let jobId: string;
  let applicationId: string;
  let missingItemId: string;
  let computedContentHash: string;

  beforeAll(async () => {
    // 1. Register candidate user
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Jordan Lifecycle',
      email: testUserEmail,
      password,
    });
    expect(regRes.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
    userId = user!.id;
    await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });

    // 2. Login to get token
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUserEmail,
      password,
    });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.accessToken;

    // 3. Create Candidate Profile & Preferences
    const profile = await prisma.candidateProfile.create({
      data: {
        userId,
        fullName: 'Jordan Lifecycle',
        headline: 'Staff Distributed Systems Engineer',
        locationCity: 'San Francisco',
        locationCountry: 'United States',
      },
    });

    await prisma.candidatePreferences.create({
      data: {
        profileId: profile.id,
        targetTitles: ['Staff Engineer', 'Senior Backend Engineer'],
        remotePreference: 'REMOTE',
        minSalary: 140000,
        expectedSalary: 180000,
        workAuthCountries: ['United States'],
        requiresSponsorship: false,
        noticePeriodDays: 21,
        blockedCompanies: [],
      },
    });

    await prisma.experience.create({
      data: {
        profileId: profile.id,
        company: 'Stripe',
        title: 'Senior Software Engineer',
        description: 'Engineered high-throughput payments processing pipeline.',
        metrics: [
          'Built distributed ledger processing $50B annually with 99.999% availability.',
          'Migrated transaction infrastructure to TypeScript and Go.',
        ],
        technologies: ['TypeScript', 'Go', 'Distributed Systems', 'PostgreSQL'],
        startDate: '2021-01-01',
        isCurrent: true,
      },
    });

    await prisma.project.create({
      data: {
        profileId: profile.id,
        name: 'High-Concurrency Event Mesh',
        role: '100,000+ messages per second at sub-millisecond p99 latency',
        description: 'Open-source distributed event mesh written in Go and Kafka.',
        techStack: ['Go', 'Kafka', 'Kubernetes'],
      },
    });

    // 4. Create target Job Posting that mandates Kubernetes (which candidate has in project, but notice period question will trigger missing info)
    const fp = generateJobFingerprint('Anthropic', 'Staff Distributed Systems Engineer', 'San Francisco, CA');
    const job = await prisma.jobPosting.create({
      data: {
        provider: 'USER_PASTED',
        company: 'Anthropic',
        title: 'Staff Distributed Systems Engineer',
        description: 'We are hiring a Staff Distributed Systems Engineer to scale our core model training compute infrastructure. Required skills: Go, Kubernetes, Kafka, Distributed Systems.',
        jobUrl: 'https://anthropic.com/careers/staff-systems-engineer',
        applyUrl: 'https://jobs.lever.co/anthropic/staff-systems-engineer',
        location: 'San Francisco, CA',
        country: 'United States',
        remoteType: 'REMOTE',
        seniority: 'LEAD',
        minSalary: 180000,
        maxSalary: 260000,
        currency: 'USD',
        skills: ['Go', 'Kubernetes', 'Kafka', 'Distributed Systems'],
        qualifications: ["Bachelor's Degree in CS"],
        status: 'OPEN',
        fingerprint: fp,
      },
    });
    jobId = job.id;

    await prisma.jobRequirement.create({
      data: {
        jobId,
        description: 'Must have verified experience with distributed systems and Go',
        skill: 'Go',
        isHardConstraint: true,
        weight: 1.0,
      },
    });
  });

  afterAll(async () => {
    // Cleanup records
    await prisma.interviewSchedule.deleteMany({ where: { application: { userId } } });
    await prisma.applicationEvent.deleteMany({ where: { application: { userId } } });
    await prisma.missingInfoRequest.deleteMany({ where: { userId } });
    await prisma.application.deleteMany({ where: { userId } });
    await prisma.jobRequirement.deleteMany({ where: { jobId } });
    await prisma.jobPosting.deleteMany({ where: { id: jobId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('1. POST /api/v1/applications initializes workflow and pauses in WAITING_FOR_USER on missing info', async () => {
    const res = await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        jobId,
        mode: 'APPROVAL_REQUIRED',
        notes: 'Target top-tier AI systems role',
      });

    if (res.status !== 201) {
      console.error('TEST 1 ERROR BODY:', JSON.stringify(res.body));
    }
    expect(res.status).toBe(201);
    expect(res.body.application).toBeDefined();
    applicationId = res.body.application.id;

    expect(res.body.application.jobId).toBe(jobId);
    expect(res.body.application.workflowStatus).toBe('WAITING_FOR_USER');
    expect(res.body.application.matchScore).toBeGreaterThan(0);
    expect(res.body.application.missingItems.length).toBeGreaterThan(0);
  });

  it('2. GET /api/v1/missing-info lists pending screening questions with explanation and suggestions', async () => {
    const res = await request(app)
      .get('/api/v1/missing-info')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);

    const item = res.body.items[0];
    missingItemId = item.id;
    expect(item.applicationId).toBe(applicationId);
    expect(item.companyName).toBe('Anthropic');
    expect(item.reason).toBeDefined();
    expect(item.suggestedAnswer).toBeDefined();
  });

  it('3. POST /api/v1/missing-info/:id/resolve saves candidate answer, projects to graph, and resumes workflow to AWAITING_APPROVAL', async () => {
    // Resolve any pending items
    const listRes = await request(app)
      .get('/api/v1/missing-info')
      .set('Authorization', `Bearer ${token}`);

    for (const item of listRes.body.items) {
      const resolveRes = await request(app)
        .post(`/api/v1/missing-info/${item.id}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          candidateAnswer: 'Available to start within 3 weeks of offer acceptance.',
          answerScope: 'GLOBAL',
        });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.item.status).toBe('ANSWERED');
    }

    // Verify application state transitioned to AWAITING_APPROVAL with computed contentHash
    const appRes = await request(app)
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(appRes.status).toBe(200);
    expect(appRes.body.application.workflowStatus).toBe('AWAITING_APPROVAL');
    expect(appRes.body.application.contentHash).toBeDefined();
    expect(appRes.body.application.coverLetterText).toContain('Anthropic');
    expect(appRes.body.application.tailoredResumeJson.tailoredBullets.length).toBeGreaterThan(0);

    computedContentHash = appRes.body.application.contentHash;
  });

  it('4. GET /api/v1/approvals displays application awaiting candidate sign-off', async () => {
    const res = await request(app)
      .get('/api/v1/approvals')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.approvals.length).toBeGreaterThan(0);

    const approval = res.body.approvals.find((a: any) => a.id === applicationId);
    expect(approval).toBeDefined();
    expect(approval.company).toBe('Anthropic');
    expect(approval.contentHash).toBe(computedContentHash);
    expect(approval.coverLetterText).toBeDefined();
  });

  it('5. POST /api/v1/approvals/:id/approve rejects tampered content hash (Security Gate)', async () => {
    const res = await request(app)
      .post(`/api/v1/approvals/${applicationId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        contentHash: 'tampered_invalid_sha256_hash_value',
        submissionChannel: 'MANUAL_FALLBACK',
      });

    // Should reject approval because content hash does not match
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('6. POST /api/v1/approvals/:id/approve accepts verified content hash, moves to SUBMITTED, and generates confirmation ID', async () => {
    const res = await request(app)
      .post(`/api/v1/approvals/${applicationId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        contentHash: computedContentHash,
        submissionChannel: 'MANUAL_FALLBACK',
      });

    expect(res.status).toBe(200);
    expect(res.body.application.workflowStatus).toBe('SUBMITTED');
    expect(res.body.application.stage).toBe('APPLIED');
    expect(res.body.application.submissionConfirmationId).toMatch(/^SUBMIT_/);
    expect(res.body.application.submissionSnapshot).toBeDefined();
  });

  it('7. PATCH /api/v1/applications/:id/stage updates tracking pipeline stage', async () => {
    const res = await request(app)
      .patch(`/api/v1/applications/${applicationId}/stage`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        stage: 'SCREENING',
        notes: 'Recruiter reached out for initial phone screen.',
      });

    expect(res.status).toBe(200);
    expect(res.body.application.stage).toBe('SCREENING');
  });

  it('8. POST /api/v1/applications/:id/interviews schedules interview and auto-advances stage to INTERVIEWING', async () => {
    const interviewDate = new Date(Date.now() + 86400000 * 3).toISOString();

    const res = await request(app)
      .post(`/api/v1/applications/${applicationId}/interviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        roundName: 'Distributed Systems Architecture Screen',
        roundType: 'TECHNICAL',
        scheduledAt: interviewDate,
        durationMinutes: 60,
        meetingLink: 'https://meet.google.com/xyz-abc-def',
        interviewerNames: ['Elena Rostova (Principal Engineer)'],
        notes: 'Prepare deep dive on raft consensus and throughput optimizations.',
      });

    expect(res.status).toBe(201);
    expect(res.body.interview.roundName).toBe('Distributed Systems Architecture Screen');

    // Verify stage updated to INTERVIEWING
    const appRes = await request(app)
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(appRes.body.application.stage).toBe('INTERVIEWING');
    expect(appRes.body.application.interviews.length).toBe(1);
    expect(appRes.body.application.events.length).toBeGreaterThanOrEqual(4);
  });

  it('9. GET /api/v1/applications/:id/packet returns copyable manual submission packet', async () => {
    const res = await request(app)
      .get(`/api/v1/applications/${applicationId}/packet`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.packet).toBeDefined();
    expect(res.body.packet.company).toBe('Anthropic');
    expect(res.body.packet.applyUrl).toContain('anthropic');
    expect(res.body.packet.tailoredBullets.length).toBeGreaterThan(0);
    expect(res.body.packet.coverLetterText).toContain('Anthropic');
    expect(res.body.packet.preparedAnswers.length).toBeGreaterThan(0);
  });

  it('10. GET /api/v1/applications lists applications with stage filter and search', async () => {
    const res = await request(app)
      .get('/api/v1/applications?stage=INTERVIEWING')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.applications.length).toBeGreaterThan(0);
    expect(res.body.applications[0].id).toBe(applicationId);
    expect(res.body.applications[0].company).toBe('Anthropic');
  });
});
