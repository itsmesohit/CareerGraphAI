import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';
import { ApplicationStateMachine } from '../services/applications/applicationStateMachine.js';
import { generateJobFingerprint } from '../services/jobs/skillExtractor.js';

const app = createApp();

describe('CareerGraph Phase 7: Assisted Apply & Automation Channels (Spec §13, §16, §17)', () => {
  const testUserEmail = `automation_candidate_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  let token: string;
  let userId: string;
  let jobId: string;
  let applicationId: string;
  let contentHash: string;

  beforeAll(async () => {
    // 1. Register candidate user
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Maya Automator',
      email: testUserEmail,
      password,
    });
    expect(regRes.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
    userId = user!.id;
    await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });

    // 2. Login
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUserEmail,
      password,
    });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.accessToken;

    // 3. Create Candidate Profile
    await prisma.candidateProfile.create({
      data: {
        userId,
        fullName: 'Maya Automator',
        headline: 'Principal Site Reliability Engineer',
        phone: '+1-555-829-1920',
        locationCity: 'San Francisco',
        locationCountry: 'United States',
        linkedinUrl: 'https://linkedin.com/in/maya-automator',
        githubUrl: 'https://github.com/maya-automator',
        portfolioUrl: 'https://maya-automator.dev',
      },
    });

    // 4. Create Job Listing
    const fingerprint = generateJobFingerprint('Stripe', 'Principal SRE', 'San Francisco, CA');
    const job = await prisma.jobPosting.create({
      data: {
        company: 'Stripe',
        title: 'Principal SRE',
        description: 'Principal Site Reliability Engineer scaling global financial infrastructure. Requires Kubernetes, Go, Distributed Systems.',
        jobUrl: 'https://boards.greenhouse.io/stripe/jobs/482910',
        applyUrl: 'https://boards.greenhouse.io/stripe/jobs/482910',
        provider: 'GREENHOUSE',
        fingerprint,
        location: 'San Francisco, CA',
        remoteType: 'REMOTE',
      },
    });
    jobId = job.id;

    // 5. Create Approved Application with valid Content Hash
    const rawAnswers = {
      work_auth: {
        questionKey: 'work_auth',
        question: 'Are you authorized to work in the US?',
        answer: 'Yes, authorized without sponsorship.',
        confidence: 1.0,
        source: 'USER_VERIFIED',
      },
    };

    contentHash = ApplicationStateMachine.computeContentHash({
      jobId,
      company: 'Stripe',
      coverLetterText: 'Dear Stripe hiring team, I am excited to apply for the Principal SRE role.',
      preparedAnswers: rawAnswers,
    });

    const application = await prisma.application.create({
      data: {
        userId,
        jobId,
        stage: 'PREPARING',
        workflowStatus: 'AWAITING_APPROVAL',
        mode: 'APPROVAL_REQUIRED',
        submissionChannel: 'PLAYWRIGHT_AUTO',
        matchScore: 92,
        contentHash,
        tailoredResumeJson: {
          tailoredBullets: [
            'Architected Kubernetes multi-region failover cluster reducing downtime by 99.99%',
            'Automated CI/CD pipelines deploying 400+ microservices deterministically',
          ],
        },
        coverLetterText: 'Dear Stripe hiring team, I am excited to apply for the Principal SRE role.',
        preparedAnswers: rawAnswers,
      },
    });
    applicationId = application.id;
  });

  afterAll(async () => {
    if (applicationId) await prisma.applicationEvent.deleteMany({ where: { applicationId } });
    if (userId) await prisma.application.deleteMany({ where: { userId } });
    if (jobId) await prisma.jobPosting.deleteMany({ where: { id: jobId } });
    if (userId) await prisma.candidateProfile.deleteMany({ where: { userId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('1. GET /api/v1/automation/payload/:applicationId returns grounded autofill payload with contentHash', async () => {
    const res = await request(app)
      .get(`/api/v1/automation/payload/${applicationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.payload).toBeDefined();
    expect(res.body.payload.company).toBe('Stripe');
    expect(res.body.payload.candidate.fullName).toBe('Maya Automator');
    expect(res.body.payload.candidate.firstName).toBe('Maya');
    expect(res.body.payload.candidate.lastName).toBe('Automator');
    expect(res.body.payload.candidate.email).toBe(testUserEmail);
    expect(res.body.payload.contentHash).toBe(contentHash);
    expect(res.body.payload.tailoredBullets.length).toBe(2);
    expect(res.body.payload.coverLetterText).toContain('Dear Stripe');
    expect(res.body.payload.proceduralSelectors).toBeDefined();
    // Greenhouse specific selectors included
    expect(res.body.payload.proceduralSelectors.first_name).toBeDefined();
  });

  it('2. POST /api/v1/automation/playwright-submit rejects tampered contentHash', async () => {
    const res = await request(app)
      .post('/api/v1/automation/playwright-submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        contentHash: 'tampered_sha256_hash_value_12345678',
        idempotencyKey: `idemp_${Date.now()}_tamper`,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Content hash mismatch');
  });

  it('3. POST /api/v1/automation/playwright-submit halts on CAPTCHA circuit breaker and enters NEEDS_INTERVENTION', async () => {
    const idempotencyKey = `idemp_captcha_${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/automation/playwright-submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        contentHash,
        idempotencyKey,
        simulatedFailure: 'CAPTCHA',
      });

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('NEEDS_INTERVENTION');
    expect(res.body.result.interventionReason).toContain('CAPTCHA');

    // Verify application state transitioned to NEEDS_INTERVENTION
    const appRecord = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(appRecord!.workflowStatus).toBe('NEEDS_INTERVENTION');

    // Reset status back to AWAITING_APPROVAL for subsequent submission test
    await prisma.application.update({
      where: { id: applicationId },
      data: { workflowStatus: 'AWAITING_APPROVAL' },
    });
  });

  it('4. POST /api/v1/automation/playwright-submit submits successfully with verified hash and idempotencyKey', async () => {
    const idempotencyKey = `idemp_success_${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/automation/playwright-submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        contentHash,
        idempotencyKey,
        simulatedFailure: 'NONE',
      });

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('SUBMITTED');
    expect(res.body.result.confirmationId).toContain('CG-AUTO');

    // Verify application state in database
    const appRecord = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(appRecord!.workflowStatus).toBe('SUBMITTED');
    expect(appRecord!.stage).toBe('APPLIED');
    expect(appRecord!.submissionConfirmationId).toBe(res.body.result.confirmationId);
  });

  it('5. POST /api/v1/automation/playwright-submit enforces Idempotency: replay returns identical cached result', async () => {
    const idempotencyKey = `idemp_replay_${Date.now()}`;

    // Reset to AWAITING_APPROVAL
    await prisma.application.update({
      where: { id: applicationId },
      data: { workflowStatus: 'AWAITING_APPROVAL' },
    });

    // First request
    const firstRes = await request(app)
      .post('/api/v1/automation/playwright-submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        contentHash,
        idempotencyKey,
        simulatedFailure: 'NONE',
      });

    expect(firstRes.status).toBe(200);
    const originalConfirmation = firstRes.body.result.confirmationId;

    // Second request with exact same idempotencyKey
    const replayRes = await request(app)
      .post('/api/v1/automation/playwright-submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        contentHash,
        idempotencyKey,
        simulatedFailure: 'NONE',
      });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.result.confirmationId).toBe(originalConfirmation);
  });

  it('6. POST /api/v1/automation/procedural-memory records and GET retrieves learned form selectors', async () => {
    const domain = 'stripe.com';
    const customSelectors = {
      custom_sponsor_field: 'select#sponsorship_required',
      custom_years_exp: 'input#years_experience',
    };

    const postRes = await request(app)
      .post('/api/v1/automation/procedural-memory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        domain,
        atsType: 'GREENHOUSE',
        selectors: customSelectors,
      });

    expect(postRes.status).toBe(200);
    expect(postRes.body.memory.domain).toBe(domain);

    const getRes = await request(app)
      .get(`/api/v1/automation/procedural-memory/${domain}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.selectors.custom_sponsor_field).toBe('select#sponsorship_required');
  });

  it('7. POST /api/v1/automation/report-result transitions application state to SUBMITTED via extension', async () => {
    await prisma.application.update({
      where: { id: applicationId },
      data: { workflowStatus: 'READY_TO_SUBMIT', stage: 'PREPARING' },
    });

    const res = await request(app)
      .post('/api/v1/automation/report-result')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        status: 'SUBMITTED',
        channel: 'ASSISTED_EXTENSION',
        confirmationUrl: 'https://boards.greenhouse.io/stripe/jobs/482910/thank_you',
        learnedSelectors: {
          first_name: 'input#custom_first_name',
        },
        notes: 'User verified in extension and clicked Submit',
      });

    expect(res.status).toBe(200);
    expect(res.body.application.workflowStatus).toBe('SUBMITTED');
    expect(res.body.application.stage).toBe('APPLIED');

    // Verify audit event
    const events = await prisma.applicationEvent.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
    expect(events.some((e) => e.title.includes('Assisted Apply Extension'))).toBe(true);
  });

  it('8. POST /api/v1/automation/report-result records NEEDS_INTERVENTION when extension encounters unhandled challenge', async () => {
    const res = await request(app)
      .post('/api/v1/automation/report-result')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        status: 'NEEDS_INTERVENTION',
        channel: 'ASSISTED_EXTENSION',
        interventionReason: 'SMS verification required by employer portal',
      });

    expect(res.status).toBe(200);
    expect(res.body.application.workflowStatus).toBe('NEEDS_INTERVENTION');

    const appRecord = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(appRecord!.workflowStatus).toBe('NEEDS_INTERVENTION');
  });

  it('9. POST /api/v1/automation/report-result records SUBMISSION_UNCERTAIN without auto-retry per spec §13', async () => {
    const res = await request(app)
      .post('/api/v1/automation/report-result')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        status: 'SUBMISSION_UNCERTAIN',
        channel: 'ASSISTED_EXTENSION',
        notes: 'Network timeout after submit button click; awaiting manual confirmation',
      });

    expect(res.status).toBe(200);
    expect(res.body.application.workflowStatus).toBe('SUBMISSION_UNCERTAIN');
  });
});
