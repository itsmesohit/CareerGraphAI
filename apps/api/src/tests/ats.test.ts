import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';

const app = createApp();

const SAMPLE_RESUME = `Alex Mercer
alex.mercer@example.com | +1 (555) 019-2834 | San Francisco, CA
linkedin.com/in/alex-mercer | github.com/alex-mercer

SUMMARY
Staff engineer with 8 years of experience building distributed systems.

EXPERIENCE
Senior Software Engineer, Stripe (2021-2023)
- Led ledger infrastructure migration serving billions of requests.
- Reduced p99 latency by 35% and scaled throughput 10x.
Software Engineer, Meta (2018-2021)
- Built rate limiting service protecting core APIs.
- Improved reliability to 99.99% across 3 regions.

EDUCATION
B.Tech Computer Science, IIT Delhi (2014-2018)

SKILLS
Go, TypeScript, PostgreSQL, Kubernetes, Kafka, React, Node.js, Redis, gRPC, Docker

PROJECTS
Distributed Cache - Built a Redis-compatible cache; reduced infra costs by 40%.`;

describe('CareerGraph Phase 16: ATS Score, Profile Assets & Latest-First Ordering', () => {
  const testEmail = `ats_candidate_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';
  let accessToken: string;
  let latestScore: number;

  beforeAll(async () => {
    // 1. Create and verify test candidate
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Mercer',
      email: testEmail,
      password: testPassword,
    });
    expect(regRes.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).not.toBeNull();
    await prisma.user.update({ where: { id: user!.id }, data: { isEmailVerified: true } });

    // 2. Login for access token
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    expect(loginRes.status).toBe(200);
    accessToken = loginRes.body.data.accessToken;
    expect(accessToken).toBeDefined();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'ats_candidate_' } } });
    await prisma.$disconnect();
  });

  it('1. GET /resumes/ats/latest returns null before any resume is scored', async () => {
    const res = await request(app)
      .get('/api/v1/resumes/ats/latest')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.latest).toBeNull();
  });

  it('2. POST /resumes/ats-check rejects with NO_RESUME before a resume is uploaded', async () => {
    const res = await request(app)
      .post('/api/v1/resumes/ats-check')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_RESUME');
  });

  it('3. POST /resumes/ats-check requires authentication', async () => {
    const res = await request(app).post('/api/v1/resumes/ats-check').send({});
    expect(res.status).toBe(401);
  });

  it('4. POST /resumes/upload accepts a text resume and stores it on the profile', async () => {
    const res = await request(app)
      .post('/api/v1/resumes/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from(SAMPLE_RESUME), { filename: 'resume.txt', contentType: 'text/plain' });
    expect(res.status).toBe(200);
    expect(res.body.fileName).toBe('resume.txt');
    expect(res.body.rawText).toContain('Stripe');
    expect(res.body.profile).toBeDefined();
  });

  it('5. POST /resumes/ats-check scores the resume across all 7 categories', async () => {
    const res = await request(app)
      .post('/api/v1/resumes/ats-check')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(200);

    const report = res.body.report;
    expect(report).toBeDefined();
    expect(Number.isInteger(report.score)).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(typeof report.grade).toBe('string');
    expect(report.grade.length).toBeLessThanOrEqual(3);
    // LLM is disabled in the test environment — deterministic engine must run
    expect(report.mode).toBe('DETERMINISTIC_FALLBACK');
    latestScore = report.score;

    // Full 7-category breakdown
    expect(report.breakdown).toHaveLength(7);
    expect(report.breakdown.map((b: any) => b.key)).toEqual([
      'CONTACT',
      'SECTIONS',
      'ACTION_VERBS',
      'QUANTIFICATION',
      'KEYWORDS',
      'READABILITY',
      'PROFILE_DEPTH',
    ]);
    for (const item of report.breakdown) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(item.maxScore);
      expect(item.label).toBeTruthy();
      expect(item.detail).toBeTruthy();
    }

    // Keyword match report
    expect(report.keywordMatches.matched).toBeInstanceOf(Array);
    expect(report.keywordMatches.missing).toBeInstanceOf(Array);

    // Improvement suggestions, each with valid severity
    expect(report.suggestions.length).toBeGreaterThanOrEqual(1);
    for (const s of report.suggestions) {
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(s.severity);
      expect(s.title.length).toBeGreaterThanOrEqual(3);
      expect(s.detail.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('6. GET /resumes/ats/latest returns the persisted report for the latest resume', async () => {
    const res = await request(app)
      .get('/api/v1/resumes/ats/latest')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    const latest = res.body.latest;
    expect(latest).not.toBeNull();
    expect(latest.score).toBe(latestScore);
    expect(latest.grade).toBe(res.body.latest.report.grade);
    // Full persisted report is nested under `report` (same DTO as POST /ats-check)
    expect(latest.report.score).toBe(latestScore);
    expect(latest.report.breakdown).toHaveLength(7);
    expect(latest.report.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(latest.report.checkedAt).toBeTruthy();
    expect(latest.checkedAt).toBeTruthy();
    expect(latest.resumeFileName).toBe('resume.txt');
  });

  it('7. GET /profile exposes the persisted ATS score on the candidate profile', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();
    expect(res.body.profile.resumeAtsScore).toBe(latestScore);
    expect(typeof res.body.profile.resumeAtsGrade).toBe('string');
    expect(res.body.profile.resumeAtsCheckedAt).toBeTruthy();
  });

  it('8. PUT /profile/assets saves cover letter, video intro URL and profile picture', async () => {
    const res = await request(app)
      .put('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        coverLetterText:
          'Dear Hiring Team, I am excited to apply for this role. My experience building distributed systems at scale makes me a strong fit.',
        videoIntroUrl: 'https://www.loom.com/share/abc123',
        profilePictureUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      });
    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();
    expect(res.body.profile.coverLetterText).toContain('excited');
    expect(res.body.profile.videoIntroUrl).toContain('loom.com');
    expect(res.body.profile.profilePictureUrl).toMatch(/^data:image\//);

    // Round-trip: assets persist across profile fetches
    const getRes = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.body.profile.coverLetterText).toContain('excited');
    expect(getRes.body.profile.videoIntroUrl).toContain('loom.com');
    expect(getRes.body.profile.profilePictureUrl).toMatch(/^data:image\//);
  });

  it('9. PUT /profile/assets rejects invalid video URLs and oversized cover letters', async () => {
    const badUrl = await request(app)
      .put('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ videoIntroUrl: 'not-a-valid-url' });
    expect(badUrl.status).toBe(400);
    expect(badUrl.body.code).toBe('VALIDATION_ERROR');

    const badLetter = await request(app)
      .put('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ coverLetterText: 'x'.repeat(20001) });
    expect(badLetter.status).toBe(400);
    expect(badLetter.body.code).toBe('VALIDATION_ERROR');

    const badPicture = await request(app)
      .put('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ profilePictureUrl: 'data:text/html;base64,PHNjcmlwdD4=' });
    expect(badPicture.status).toBe(400);
    expect(badPicture.body.code).toBe('VALIDATION_ERROR');
  });

  it('10. experiences are returned latest-first: current roles first, then by year descending', async () => {
    // Insert deliberately out of chronological order
    const oldest = await request(app)
      .post('/api/v1/profile/experiences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ company: 'Old Corp', title: 'Junior Engineer', startDate: '2015', endDate: '2017', isCurrent: false });
    expect(oldest.status).toBe(201);

    const current = await request(app)
      .post('/api/v1/profile/experiences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ company: 'Current Corp', title: 'Staff Engineer', startDate: '2023', isCurrent: true });
    expect(current.status).toBe(201);

    const middle = await request(app)
      .post('/api/v1/profile/experiences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ company: 'Mid Corp', title: 'Senior Engineer', startDate: '2019', endDate: '2022', isCurrent: false });
    expect(middle.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    const mine = res.body.profile.experiences.filter((e: any) =>
      ['Old Corp', 'Current Corp', 'Mid Corp'].includes(e.company)
    );
    expect(mine).toHaveLength(3);
    expect(mine.map((e: any) => e.company)).toEqual(['Current Corp', 'Mid Corp', 'Old Corp']);
  });

  it('11. educations are returned latest-first by completion year', async () => {
    const oldEdu = await request(app)
      .post('/api/v1/profile/educations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ institution: 'Old University', degree: 'B.Tech', field: 'Computer Science', startDate: '2011', endDate: '2015' });
    expect(oldEdu.status).toBe(201);

    const newEdu = await request(app)
      .post('/api/v1/profile/educations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ institution: 'New University', degree: 'M.S.', field: 'Distributed Systems', startDate: '2018', endDate: '2020' });
    expect(newEdu.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    const mine = res.body.profile.educations.filter((e: any) =>
      ['Old University', 'New University'].includes(e.institution)
    );
    expect(mine).toHaveLength(2);
    expect(mine.map((e: any) => e.institution)).toEqual(['New University', 'Old University']);
  });
});
