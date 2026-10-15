import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';
import { resumeParserService } from '../services/resumeParserService.js';

const app = createApp();

describe('CareerGraph Phase 2: Profile, Onboarding & Question Engine', () => {
  const testEmail = `candidate_profile_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';
  let accessToken: string;
  let userId: string;
  let testExpId: string;
  let testSkillId: string;

  beforeAll(async () => {
    // 1. Create and verify test candidate
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Mercer',
      email: testEmail,
      password: testPassword,
    });
    expect(regRes.status).toBe(201);

    // Verify email directly in DB for test speed
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).not.toBeNull();
    userId = user!.id;
    await prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    // Login to get access token
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    expect(loginRes.status).toBe(200);
    accessToken = loginRes.body.data.accessToken;
    expect(accessToken).toBeDefined();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'candidate_profile_' } },
    });
    await prisma.$disconnect();
  });

  it('1. GET /api/v1/profile initializes and returns candidate profile', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();
    expect(res.body.profile.userId).toBe(userId);
    expect(res.body.profile.experiences).toBeInstanceOf(Array);
    expect(res.body.profile.skills).toBeInstanceOf(Array);
  });

  it('2. PUT /api/v1/profile updates candidate profile basics', async () => {
    const res = await request(app)
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        headline: 'Staff Distributed Systems Engineer',
        phone: '+1 (555) 019-2834',
        locationCity: 'San Francisco',
        locationState: 'CA',
        locationCountry: 'United States',
        linkedinUrl: 'https://linkedin.com/in/alex-mercer',
        githubUrl: 'https://github.com/alex-mercer',
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.headline).toBe('Staff Distributed Systems Engineer');
    expect(res.body.profile.locationCity).toBe('San Francisco');
    expect(res.body.profile.linkedinUrl).toBe('https://linkedin.com/in/alex-mercer');
  });

  it('3. POST /api/v1/profile/experiences creates experience with UNVERIFIED status', async () => {
    const res = await request(app)
      .post('/api/v1/profile/experiences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        company: 'Stripe',
        title: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        startDate: '2021-03',
        isCurrent: true,
        description: 'Led ledger infrastructure migrations serving billions of requests.',
        metrics: ['Reduced p99 latency by 35%', 'Scaled throughput 10x'],
        technologies: ['Go', 'TypeScript', 'PostgreSQL', 'Kafka'],
        source: 'RESUME_UPLOAD',
        verificationStatus: 'UNVERIFIED',
      });

    expect(res.status).toBe(201);
    expect(res.body.experience).toBeDefined();
    expect(res.body.experience.company).toBe('Stripe');
    expect(res.body.experience.verificationStatus).toBe('UNVERIFIED');
    expect(res.body.experience.metrics).toHaveLength(2);
    testExpId = res.body.experience.id;
  });

  it('4. PATCH /api/v1/profile/facts/experience/:id/verify toggles to USER_VERIFIED', async () => {
    const res = await request(app)
      .patch(`/api/v1/profile/facts/experience/${testExpId}/verify`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'USER_VERIFIED' });

    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe(testExpId);
    expect(res.body.item.verificationStatus).toBe('USER_VERIFIED');
  });

  it('5. POST /api/v1/profile/skills and verifies fact verification toggle', async () => {
    const createRes = await request(app)
      .post('/api/v1/profile/skills')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Distributed Systems',
        category: 'Backend',
        proficiency: 'Expert',
        yearsExperience: 5,
        source: 'RESUME_UPLOAD',
        verificationStatus: 'UNVERIFIED',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.skill.name).toBe('Distributed Systems');
    testSkillId = createRes.body.skill.id;

    // Verify it
    const verifyRes = await request(app)
      .patch(`/api/v1/profile/facts/skill/${testSkillId}/verify`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'USER_VERIFIED' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.item.verificationStatus).toBe('USER_VERIFIED');
  });

  it('6. Deterministic Resume Parser extracts structured facts correctly', () => {
    const sampleResume = `
Alex Mercer
Staff Distributed Systems Engineer
alex.mercer@example.com | (555) 234-5678 | San Francisco, CA
https://linkedin.com/in/alex-mercer | https://github.com/alex-mercer

PROFESSIONAL EXPERIENCE
Stripe | Senior Infrastructure Engineer | 2021 - Present
• Designed distributed database partition framework handling 50M requests/day.
• Reduced p99 latency by 45% using Redis caching and Go goroutines.
• Technologies: Go, TypeScript, Docker, Kubernetes, PostgreSQL.

Acme Corp | Software Engineer | 2018 - 2021
• Developed full-stack dashboard in React and Node.js.
• Improved team deployment frequency by 80% with GitHub Actions CI/CD.

EDUCATION
University of California, Berkeley
Bachelor of Science in Computer Science | 2014 - 2018
GPA: 3.85

SKILLS
TypeScript, Go, Python, React, Next.js, Node.js, Docker, Kubernetes, AWS, PostgreSQL, Redis

PROJECTS
HyperGraph
High performance in-memory graph engine built with Rust and WebAssembly.
`;

    const parsed = resumeParserService.parseDeterministic(sampleResume, 'alex_resume.pdf');

    expect(parsed.extractedProfile.fullName).toBe('Alex Mercer');
    expect(parsed.extractedProfile.email).toBe('alex.mercer@example.com');
    expect(parsed.extractedProfile.linkedinUrl).toContain('alex-mercer');
    expect(parsed.experiences.length).toBeGreaterThanOrEqual(1);
    expect(parsed.educations.length).toBeGreaterThanOrEqual(1);
    expect(parsed.skills.length).toBeGreaterThanOrEqual(5);

    const skillNames = parsed.skills.map((s) => s.name);
    expect(skillNames).toContain('TypeScript');
    expect(skillNames).toContain('PostgreSQL');
    expect(skillNames).toContain('Docker');
  });

  it('7. POST /api/v1/resumes/upload uploads file and stores UNVERIFIED facts', async () => {
    const resumeContent = `Jane Doe
Full Stack Developer
jane.doe@example.com
(415) 555-0123
San Francisco, CA
https://linkedin.com/in/jane-doe

EXPERIENCE
Tech Solutions | Senior Developer | 2022 - Present
• Built GraphQL microservices improving latency by 30%.
• Stack: TypeScript, React, PostgreSQL.

EDUCATION
Stanford University
Bachelor of Science in Computer Science | 2018 - 2022

SKILLS
TypeScript, React, Node.js, GraphQL, PostgreSQL, Docker
`;

    const res = await request(app)
      .post('/api/v1/resumes/upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from(resumeContent), 'jane_resume.txt');

    expect(res.status).toBe(200);
    expect(res.body.fileName).toBe('jane_resume.txt');
    expect(res.body.extracted).toBeDefined();
    expect(res.body.extracted.extractedProfile.fullName).toBe('Jane Doe');
    expect(res.body.profile.experiences.length).toBeGreaterThan(0);
  });

  it('8. POST /api/v1/profile/facts/verify-all approves all unverified facts', async () => {
    const res = await request(app)
      .post('/api/v1/profile/facts/verify-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify in completeness that unverifiedFactsCount is 0
    const compRes = await request(app)
      .get('/api/v1/profile/completeness')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(compRes.status).toBe(200);
    expect(compRes.body.completeness.unverifiedFactsCount).toBe(0);
    expect(compRes.body.completeness.score).toBeGreaterThan(50);
  });

  it('9. GET /api/v1/questions fetches canonical questions from seeded DB', async () => {
    const res = await request(app).get('/api/v1/questions?coreOnly=true');

    expect(res.status).toBe(200);
    expect(res.body.questions).toBeInstanceOf(Array);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(15);

    const firstQ = res.body.questions[0];
    expect(firstQ.key).toBeDefined();
    expect(firstQ.category).toBeDefined();
    expect(firstQ.questionText).toBeDefined();
  });

  it('10. POST & GET /api/v1/questions/answers saves and retrieves candidate answers', async () => {
    const answersData = [
      {
        questionKey: 'ident_full_name',
        value: 'Alex Mercer',
        scope: 'GLOBAL',
      },
      {
        questionKey: 'comp_expected_base_usd',
        value: '180000',
        scope: 'GLOBAL',
      },
    ];

    const saveRes = await request(app)
      .post('/api/v1/questions/answers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: answersData });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.answers.length).toBe(2);

    const getRes = await request(app)
      .get('/api/v1/questions/answers')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.answers.length).toBe(2);
    expect(getRes.body.answers[0].value).toBeDefined();
  });

  it('11. GET and PUT /api/v1/onboarding/state manages resumable wizard progress', async () => {
    const getRes = await request(app)
      .get('/api/v1/onboarding/state')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.state.currentStep).toBeDefined();

    const putRes = await request(app)
      .put('/api/v1/onboarding/state')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentStep: 3,
        completedSteps: [1, 2],
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.state.currentStep).toBe(3);
    expect(putRes.body.state.completedSteps).toContain(1);
    expect(putRes.body.state.completedSteps).toContain(2);
  });

  it('12. PUT & GET /api/v1/profile/preferences configures automation mode and targets', async () => {
    const putRes = await request(app)
      .put('/api/v1/profile/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        targetTitles: ['Distributed Systems Engineer', 'Senior Backend Engineer'],
        targetLocations: ['San Francisco, CA', 'Remote'],
        seniorityLevels: ['SENIOR', 'STAFF'],
        remotePreference: 'REMOTE_FIRST',
        minSalary: 180000,
        expectedSalary: 220000,
        currency: 'USD',
        noticePeriodDays: 14,
        blockedCompanies: ['BadCompany Inc'],
        automationMode: 'BATCH_REVIEW',
        workAuthCountries: ['United States'],
        requiresSponsorship: false,
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.preferences.automationMode).toBe('BATCH_REVIEW');
    expect(putRes.body.preferences.targetTitles).toContain('Distributed Systems Engineer');

    const getRes = await request(app)
      .get('/api/v1/profile/preferences')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.preferences.automationMode).toBe('BATCH_REVIEW');
  });
});
