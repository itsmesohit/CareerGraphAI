import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';
import { TokenEncryptionService } from '../services/integrations/tokenEncryptionService.js';
import { RecruiterOutreachService } from '../services/outreach/recruiterOutreachService.js';
import { generateJobFingerprint } from '../services/jobs/skillExtractor.js';

const app = createApp();

describe('CareerGraph Phase 8: Email Integration & Recruiter Outreach (Spec §14, §16, §24)', () => {
  const testUserEmail = `outreach_candidate_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  let token: string;
  let userId: string;
  let jobId: string;
  let applicationId: string;
  let integrationId: string;
  let draftId: string;
  let interviewId: string;
  let inboundEventId: string;

  beforeAll(async () => {
    // 1. Register candidate user
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Elena Rostova',
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
        fullName: 'Elena Rostova',
        headline: 'Staff Infrastructure Engineer',
        phone: '+1-555-901-2049',
        locationCity: 'Seattle',
        locationCountry: 'United States',
        linkedinUrl: 'https://linkedin.com/in/elena-rostova',
        githubUrl: 'https://github.com/elena-rostova',
        portfolioUrl: 'https://elena-rostova.tech',
        projects: {
          create: [
            {
              name: 'Multi-Cloud Raft Consensus Engine',
              role: 'Lead Architect',
              techStack: ['Rust', 'Raft', 'gRPC', 'Distributed Systems'],
              description: 'Designed deterministic Raft distributed log with sub-millisecond failover.',
            },
          ],
        },
      },
    });

    // 4. Create Job & Application
    const fingerprint = generateJobFingerprint('Figma', 'Staff Systems Engineer', 'San Francisco, CA');
    const job = await prisma.jobPosting.create({
      data: {
        company: 'Figma',
        title: 'Staff Systems Engineer',
        description: 'Building collaborative graphics engine backend. Requires Rust, Distributed Systems, WebAssembly.',
        jobUrl: 'https://careers.figma.com/jobs/928174',
        applyUrl: 'https://careers.figma.com/jobs/928174',
        provider: 'GREENHOUSE',
        fingerprint,
        location: 'San Francisco, CA',
        remoteType: 'HYBRID',
      },
    });
    jobId = job.id;

    const application = await prisma.application.create({
      data: {
        userId,
        jobId,
        stage: 'APPLIED',
        workflowStatus: 'SUBMITTED',
        mode: 'APPROVAL_REQUIRED',
        submissionChannel: 'PLAYWRIGHT_AUTO',
        matchScore: 94,
        tailoredResumeJson: { summary: 'Staff Infrastructure Engineer' },
      },
    });
    applicationId = application.id;
  });

  afterAll(async () => {
    if (interviewId) await prisma.interviewSchedule.deleteMany({ where: { id: interviewId } });
    if (draftId) await prisma.recruiterOutreach.deleteMany({ where: { id: draftId } });
    if (inboundEventId) await prisma.inboundEmailEvent.deleteMany({ where: { id: inboundEventId } });
    if (integrationId) await prisma.userIntegration.deleteMany({ where: { id: integrationId } });
    if (applicationId) await prisma.applicationEvent.deleteMany({ where: { applicationId } });
    if (userId) await prisma.application.deleteMany({ where: { userId } });
    if (jobId) await prisma.jobPosting.deleteMany({ where: { id: jobId } });
    if (userId) await prisma.project.deleteMany({ where: { profile: { userId } } });
    if (userId) await prisma.candidateProfile.deleteMany({ where: { userId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('1. Envelope Encryption: AES-256-GCM encrypts and decrypts OAuth tokens; detects tampering', () => {
    const rawAccessToken = 'ya29.a0AfH6SMD_mock_google_oauth_token_1234567890';
    const encryptedBundle = TokenEncryptionService.encrypt(rawAccessToken);

    expect(encryptedBundle.encryptedData).toBeDefined();
    expect(encryptedBundle.encryptedDek).toBeDefined();
    expect(encryptedBundle.iv).toHaveLength(24); // 12 bytes in hex
    expect(encryptedBundle.authTag).toHaveLength(32); // 16 bytes in hex

    // Decrypt and verify round-trip
    const decrypted = TokenEncryptionService.decrypt(encryptedBundle);
    expect(decrypted).toBe(rawAccessToken);

    // Tamper detection: flip a byte in ciphertext
    const tampered = {
      ...encryptedBundle,
      encryptedData: encryptedBundle.encryptedData.slice(0, -2) + '00',
    };
    expect(() => TokenEncryptionService.decrypt(tampered)).toThrow();
  });

  it('2. GET /api/v1/integrations/oauth/gmail/authorize returns OAuth URL with minimal scopes per Spec §16', async () => {
    const res = await request(app)
      .get('/api/v1/integrations/oauth/gmail/authorize')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('GMAIL');
    expect(res.body.authorizeUrl).toContain('accounts.google.com');
    expect(res.body.authorizeUrl).toContain('gmail.send');
    expect(res.body.state).toBeDefined();
  });

  it('3. POST /api/v1/integrations/connect stores envelope-encrypted integration and GET lists sanitized', async () => {
    const res = await request(app)
      .post('/api/v1/integrations/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'GMAIL',
        accountEmail: 'elena.rostova@gmail.com',
        accessToken: 'ya29.mock_access_token_elena',
        refreshToken: '1//mock_refresh_token_elena',
        expiresInSeconds: 3600,
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
      });

    expect(res.status).toBe(201);
    expect(res.body.integration.accountEmail).toBe('elena.rostova@gmail.com');
    expect(res.body.integration.status).toBe('CONNECTED');
    integrationId = res.body.integration.id;

    // Verify DB record stores encrypted strings, NEVER raw tokens
    const dbRecord = await prisma.userIntegration.findUnique({ where: { id: integrationId } });
    expect(dbRecord!.encryptedAccessToken).not.toBe('ya29.mock_access_token_elena');
    expect(dbRecord!.encryptedDek).toBeDefined();

    // Verify GET /api/v1/integrations lists sanitized record
    const listRes = await request(app)
      .get('/api/v1/integrations')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.integrations.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.integrations[0].encryptedAccessToken).toBeUndefined();
  });

  it('4. POST /api/v1/outreach/draft generates grounded recruiter outreach draft with contentHash', async () => {
    const res = await request(app)
      .post('/api/v1/outreach/draft')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        company: 'Figma',
        jobTitle: 'Staff Systems Engineer',
        recipientName: 'Dylan Field',
        recipientEmail: 'dylan@figma.com',
        context: 'Built high-throughput consensus systems and collaborative engine internals.',
      });

    expect(res.status).toBe(201);
    expect(res.body.draft).toBeDefined();
    expect(res.body.draft.company).toBe('Figma');
    expect(res.body.draft.recipientName).toBe('Dylan Field');
    expect(res.body.draft.recipientEmail).toBe('dylan@figma.com');
    expect(res.body.draft.subject).toContain('Staff Systems Engineer');
    expect(res.body.draft.bodyText).toContain('Multi-Cloud Raft Consensus Engine');
    expect(res.body.draft.status).toBe('DRAFT');
    expect(res.body.draft.contentHash).toBeDefined();
    draftId = res.body.draft.id;
  });

  it('5. PATCH /api/v1/outreach/:id updates draft and invalidates prior approval per Spec §16', async () => {
    const res = await request(app)
      .patch(`/api/v1/outreach/${draftId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        subject: 'Connecting regarding Staff Systems Architecture at Figma — Elena Rostova',
      });

    expect(res.status).toBe(200);
    expect(res.body.draft.subject).toContain('Staff Systems Architecture');
    expect(res.body.draft.status).toBe('DRAFT');
    expect(res.body.draft.approvedAt).toBeNull();
  });

  it('6. POST /api/v1/outreach/:id/approve gates on exact contentHash; POST /send rejects tampered or unapproved', async () => {
    const draftBefore = await prisma.recruiterOutreach.findUnique({ where: { id: draftId } });

    // 1. Approve with tampered hash fails
    const badApproveRes = await request(app)
      .post(`/api/v1/outreach/${draftId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contentHash: 'tampered_sha256_hash_value_999999' });

    expect(badApproveRes.status).toBe(400);
    expect(badApproveRes.body.error).toContain('hash mismatch');

    // 2. Approve with correct hash succeeds
    const goodApproveRes = await request(app)
      .post(`/api/v1/outreach/${draftId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contentHash: draftBefore!.contentHash });

    expect(goodApproveRes.status).toBe(200);
    expect(goodApproveRes.body.draft.status).toBe('APPROVED');
    expect(goodApproveRes.body.draft.approvedAt).toBeDefined();

    // 3. Send with tampered hash fails
    const badSendRes = await request(app)
      .post(`/api/v1/outreach/${draftId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contentHash: 'tampered_hash_on_send' });

    expect(badSendRes.status).toBe(400);

    // 4. Send with verified hash dispatches and enforces quota
    const goodSendRes = await request(app)
      .post(`/api/v1/outreach/${draftId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contentHash: draftBefore!.contentHash });

    expect(goodSendRes.status).toBe(200);
    expect(goodSendRes.body.draft.status).toBe('SENT');
    expect(goodSendRes.body.draft.sentAt).toBeDefined();

    // Verify quota
    const quotaRes = await request(app)
      .get('/api/v1/outreach/quota')
      .set('Authorization', `Bearer ${token}`);

    expect(quotaRes.status).toBe(200);
    expect(quotaRes.body.quota.sentToday).toBeGreaterThanOrEqual(1);
    expect(quotaRes.body.quota.remaining).toBeLessThan(25);
  });

  it('7. POST /api/v1/inbound-emails/classify accurately classifies emails and triggers auto-stage updates', async () => {
    // 1. Classify interview invitation
    const interviewRes = await request(app)
      .post('/api/v1/inbound-emails/classify?autoApply=true')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'GMAIL',
        messageId: `msg_gmail_invitation_${Date.now()}`,
        senderEmail: 'recruiting@figma.com',
        senderName: 'Figma Talent Team',
        recipientEmail: testUserEmail,
        subject: 'Invitation to interview with Figma: Staff Systems Engineer',
        snippet: 'Hi Elena, We were impressed by your background and would like to schedule an interview with our engineering director.',
      });

    expect(interviewRes.status).toBe(201);
    expect(interviewRes.body.event.classifiedCategory).toBe('INTERVIEW_INVITATION');
    expect(interviewRes.body.event.confidence).toBeGreaterThan(0.9);
    expect(interviewRes.body.event.autoApplied).toBe(true);
    inboundEventId = interviewRes.body.event.id;

    // Verify application stage moved to INTERVIEWING
    const appRecord = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(appRecord!.stage).toBe('INTERVIEWING');

    // 2. Classify offer email
    const offerRes = await request(app)
      .post('/api/v1/inbound-emails/classify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'GMAIL',
        messageId: `msg_gmail_offer_${Date.now()}`,
        senderEmail: 'talent@figma.com',
        recipientEmail: testUserEmail,
        subject: 'Congratulations! Formal Offer of Employment from Figma',
        snippet: 'We are pleased to offer you the position of Staff Systems Engineer at Figma. Attached your offer letter.',
      });

    expect(offerRes.status).toBe(201);
    expect(offerRes.body.event.classifiedCategory).toBe('OFFER_RECEIVED');
    expect(offerRes.body.event.suggestedStatus).toBe('OFFERED');
  });

  it('8. POST /api/v1/interviews schedules interview with prep questions and GET /ics exports RFC 5545 calendar file', async () => {
    const scheduledDate = new Date(Date.now() + 86400000 * 2).toISOString(); // 2 days in future

    const createRes = await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId,
        roundName: 'System Architecture Deep Dive',
        roundType: 'System Design',
        scheduledAt: scheduledDate,
        durationMinutes: 60,
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        interviewerNames: ['Evan Wallace', 'Chief Architect'],
        notes: 'Focus on distributed consensus, canvas rendering pipeline, and fault tolerance.',
        syncCalendar: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.interview).toBeDefined();
    expect(createRes.body.interview.roundName).toBe('System Architecture Deep Dive');
    expect(createRes.body.interview.prepQuestions.length).toBeGreaterThanOrEqual(1);
    interviewId = createRes.body.interview.id;

    // Download RFC 5545 .ics file
    const icsRes = await request(app)
      .get(`/api/v1/interviews/${interviewId}/ics`)
      .set('Authorization', `Bearer ${token}`);

    expect(icsRes.status).toBe(200);
    expect(icsRes.headers['content-type']).toContain('text/calendar');
    expect(icsRes.headers['content-disposition']).toContain('.ics');
    expect(icsRes.text).toContain('BEGIN:VCALENDAR');
    expect(icsRes.text).toContain('BEGIN:VEVENT');
    expect(icsRes.text).toContain('SUMMARY:Figma — System Architecture Deep Dive (System Design)');
    expect(icsRes.text).toContain('URL:https://meet.google.com/abc-defg-hij');
    expect(icsRes.text).toContain('BEGIN:VALARM');
    expect(icsRes.text).toContain('END:VCALENDAR');
  });

  it('9. DELETE /api/v1/integrations/:id disconnects integration and purges credentials', async () => {
    const delRes = await request(app)
      .delete(`/api/v1/integrations/${integrationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);

    const exists = await prisma.userIntegration.findUnique({ where: { id: integrationId } });
    expect(exists).toBeNull();
  });
});
