import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';
import { matchingService } from '../services/matching/matchingService.js';
import { generateJobFingerprint } from '../services/jobs/skillExtractor.js';

const app = createApp();

describe('CareerGraph Phase 5: Deterministic Matching Engine (Spec §10)', () => {
  const testUserEmail = `candidate_match_${Date.now()}@example.com`;
  const visaUserEmail = `candidate_visa_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  let token: string;
  let userId: string;
  let visaUserId: string;

  let highMatchJobId: string;
  let blockedCompanyJobId: string;
  let lowSalaryJobId: string;
  let clearanceJobId: string;

  beforeAll(async () => {
    // 1. Create candidate user with rich profile
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Alex MatchingPro',
      email: testUserEmail,
      password,
    });
    expect(regRes.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
    userId = user!.id;
    await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });

    // Login to obtain JWT
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUserEmail,
      password,
    });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.accessToken;

    // Create CandidateProfile with experiences, skills, projects, educations, preferences
    const profile = await prisma.candidateProfile.create({
      data: {
        userId,
        fullName: 'Alex MatchingPro',
        headline: 'Senior Full Stack Engineer',
        preferences: {
          create: {
            targetTitles: ['Senior Full Stack Engineer', 'Full Stack Developer'],
            targetLocations: ['Remote', 'San Francisco, CA'],
            remotePreference: 'REMOTE',
            minSalary: 140000,
            expectedSalary: 190000,
            requiresSponsorship: false,
            workAuthCountries: ['USA'],
            blockedCompanies: ['EvilCorp', 'BadTech LLC'],
          },
        },
        skills: {
          create: [
            {
              name: 'TypeScript',
              category: 'Language',
              proficiency: 'EXPERT',
              yearsExperience: 6,
              verificationStatus: 'USER_VERIFIED',
            },
            {
              name: 'React',
              category: 'Frontend',
              proficiency: 'ADVANCED',
              yearsExperience: 5,
              verificationStatus: 'USER_VERIFIED',
            },
            {
              name: 'Node.js',
              category: 'Backend',
              proficiency: 'ADVANCED',
              yearsExperience: 5,
              verificationStatus: 'USER_VERIFIED',
            },
            {
              name: 'Docker',
              category: 'DevOps',
              proficiency: 'INTERMEDIATE',
              yearsExperience: 3,
              verificationStatus: 'UNVERIFIED',
            },
          ],
        },
        experiences: {
          create: [
            {
              company: 'Acme Cloud Services',
              title: 'Senior Full Stack Engineer',
              startDate: '2020-01-01',
              isCurrent: true,
              description: 'Architected scalable web applications using TypeScript, React, and Node.js microservices.',
              technologies: ['TypeScript', 'React', 'Node.js', 'Docker'],
              verificationStatus: 'USER_VERIFIED',
            },
          ],
        },
        projects: {
          create: [
            {
              name: 'Realtime Job Matching Graph',
              role: 'Creator & Lead Developer',
              description: 'Built high-throughput matching engine using TypeScript and React.',
              techStack: ['TypeScript', 'React', 'PostgreSQL'],
              verificationStatus: 'USER_VERIFIED',
            },
          ],
        },
        educations: {
          create: [
            {
              institution: 'Stanford University',
              degree: 'Bachelor of Science',
              field: 'Computer Science',
              startDate: '2015-09-01',
              endDate: '2019-06-01',
              verificationStatus: 'USER_VERIFIED',
            },
          ],
        },
      },
    });

    // 2. Create Visa candidate user for testing work authorization hard constraint
    await request(app).post('/api/v1/auth/register').send({
      name: 'Priya VisaCandidate',
      email: visaUserEmail,
      password,
    });
    const visaUser = await prisma.user.findUnique({ where: { email: visaUserEmail } });
    visaUserId = visaUser!.id;
    await prisma.user.update({ where: { id: visaUserId }, data: { isEmailVerified: true } });

    await prisma.candidateProfile.create({
      data: {
        userId: visaUserId,
        fullName: 'Priya VisaCandidate',
        preferences: {
          create: {
            requiresSponsorship: true,
            workAuthCountries: ['India'],
            remotePreference: 'REMOTE',
          },
        },
      },
    });

    // 3. Create Seed Job Postings for Test Assertions
    const runId = Date.now();

    // Job A: Strong high-affinity match (TypeScript, React, Node, Remote, Senior, $160k)
    const jobA = await prisma.jobPosting.create({
      data: {
        provider: 'REMOTIVE',
        providerJobId: `test_job_high_${runId}`,
        company: 'CloudScale Labs',
        title: 'Senior Full Stack Engineer',
        description: 'Lead engineering for our cloud portal. Requires TypeScript, React, and Node.js.',
        jobUrl: `https://example.com/jobs/cloudscale-${runId}`,
        location: 'Remote',
        remoteType: 'REMOTE',
        seniority: 'SENIOR',
        minSalary: 150000,
        maxSalary: 185000,
        currency: 'USD',
        skills: ['TypeScript', 'React', 'Node.js'],
        status: 'OPEN',
        fingerprint: generateJobFingerprint('CloudScale Labs', 'Senior Full Stack Engineer', 'Remote'),
        requirements: {
          create: [
            { description: 'Expertise with TypeScript in production', skill: 'TypeScript', isHardConstraint: false, weight: 1.5 },
            { description: 'Hands-on React architecture', skill: 'React', isHardConstraint: false, weight: 1.2 },
            { description: 'Backend microservices with Node.js', skill: 'Node.js', isHardConstraint: false, weight: 1.0 },
          ],
        },
      },
    });
    highMatchJobId = jobA.id;

    // Job B: Blocked company (EvilCorp)
    const jobB = await prisma.jobPosting.create({
      data: {
        provider: 'GREENHOUSE',
        providerJobId: `test_job_blocked_${runId}`,
        company: 'EvilCorp',
        title: 'Principal Architect',
        description: 'Build enterprise banking backend.',
        jobUrl: `https://example.com/jobs/evilcorp-${runId}`,
        location: 'Remote',
        remoteType: 'REMOTE',
        seniority: 'LEAD',
        minSalary: 170000,
        maxSalary: 220000,
        currency: 'USD',
        skills: ['TypeScript'],
        status: 'OPEN',
        fingerprint: generateJobFingerprint('EvilCorp', 'Principal Architect', 'Remote'),
      },
    });
    blockedCompanyJobId = jobB.id;

    // Job C: Low salary ceiling ($110k, below candidate's min $140k)
    const jobC = await prisma.jobPosting.create({
      data: {
        provider: 'LEVER',
        providerJobId: `test_job_lowsal_${runId}`,
        company: 'Bootstrapped LLC',
        title: 'Senior Full Stack Engineer',
        description: 'Early stage startup role.',
        jobUrl: `https://example.com/jobs/bootstrapped-${runId}`,
        location: 'Remote',
        remoteType: 'REMOTE',
        seniority: 'SENIOR',
        minSalary: 90000,
        maxSalary: 110000,
        currency: 'USD',
        skills: ['TypeScript', 'React'],
        status: 'OPEN',
        fingerprint: generateJobFingerprint('Bootstrapped LLC', 'Senior Full Stack Engineer', 'Remote'),
      },
    });
    lowSalaryJobId = jobC.id;

    // Job D: Mandates US Citizenship / Security Clearance
    const jobD = await prisma.jobPosting.create({
      data: {
        provider: 'ASHBY',
        providerJobId: `test_job_clearance_${runId}`,
        company: 'Defense Aerospace Technologies',
        title: 'Flight Systems Engineer',
        description: 'Requires active US government security clearance.',
        jobUrl: `https://example.com/jobs/defense-${runId}`,
        location: 'Washington, DC',
        remoteType: 'ONSITE',
        seniority: 'SENIOR',
        minSalary: 160000,
        maxSalary: 195000,
        currency: 'USD',
        skills: ['TypeScript'],
        status: 'OPEN',
        fingerprint: generateJobFingerprint('Defense Aerospace Technologies', 'Flight Systems Engineer', 'Washington, DC'),
        requirements: {
          create: [
            {
              description: 'Must possess active US Citizenship and Top Secret Clearance',
              isHardConstraint: true,
              category: 'WORK_AUTH',
              weight: 2.0,
            },
          ],
        },
      },
    });
    clearanceJobId = jobD.id;
  });

  afterAll(async () => {
    // Cleanup database
    const jobIds = [highMatchJobId, blockedCompanyJobId, lowSalaryJobId, clearanceJobId].filter(Boolean);
    if (jobIds.length > 0) {
      await prisma.jobRequirement.deleteMany({
        where: { jobId: { in: jobIds } },
      });
      await prisma.jobPosting.deleteMany({
        where: { id: { in: jobIds } },
      });
    }
    await prisma.user.deleteMany({ where: { email: { in: [testUserEmail, visaUserEmail] } } });
    await prisma.$disconnect();
  });

  it('1. Computes high affinity match (>80%) with full factor breakdown and supporting evidence', async () => {
    const result = await matchingService.evaluateMatch(userId, highMatchJobId);

    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.isEliminated).toBe(false);
    expect(result.disqualifiers).toHaveLength(0);
    expect(result.recommendation).toBe('STRONG_MATCH');

    // Verify detailed breakdown
    expect(result.breakdown.requiredSkillsScore).toBeGreaterThanOrEqual(85);
    expect(result.breakdown.seniorityScore).toBe(100);
    expect(result.breakdown.locationScore).toBe(100);
    expect(result.breakdown.compensationScore).toBe(100);

    // Verify matched skills & verification flags
    expect(result.matchedSkills.length).toBeGreaterThanOrEqual(3);
    const tsSkill = result.matchedSkills.find((s) => s.skill === 'TypeScript');
    expect(tsSkill).toBeDefined();
    expect(tsSkill!.isVerified).toBe(true);

    // Verify supporting items
    expect(result.supportingExperiences.length).toBeGreaterThanOrEqual(1);
    expect(result.supportingProjects.length).toBeGreaterThanOrEqual(1);

    // Verify concise grounded explanation
    expect(result.conciseExplanation).toContain('fit');
    expect(result.conciseExplanation).toContain('TypeScript');
  });

  it('2. Hard constraint enforcement: Disqualifies candidate on blocked company filter', async () => {
    const result = await matchingService.evaluateMatch(userId, blockedCompanyJobId);

    expect(result.overallScore).toBe(0);
    expect(result.isEliminated).toBe(true);
    expect(result.recommendation).toBe('DISQUALIFIED');
    expect(result.disqualifiers.length).toBeGreaterThan(0);
    expect(result.disqualifiers[0]).toContain('EvilCorp');
  });

  it('3. Hard constraint enforcement: Disqualifies candidate when job salary ceiling is below minimum requirement', async () => {
    const result = await matchingService.evaluateMatch(userId, lowSalaryJobId);

    expect(result.overallScore).toBe(0);
    expect(result.isEliminated).toBe(true);
    expect(result.recommendation).toBe('DISQUALIFIED');
    expect(result.disqualifiers[0]).toContain('salary ceiling');
  });

  it('4. Hard constraint enforcement: Disqualifies candidate when work authorization conflicts', async () => {
    // Priya has H1B Visa, but job mandates US Citizenship & Clearance
    const result = await matchingService.evaluateMatch(visaUserId, clearanceJobId);

    expect(result.overallScore).toBe(0);
    expect(result.isEliminated).toBe(true);
    expect(result.recommendation).toBe('DISQUALIFIED');
    expect(result.disqualifiers[0]).toContain('Mandatory legal constraint');
  });

  it('5. GET /api/v1/matches/jobs/:jobId returns explainable match evaluation over HTTP', async () => {
    const res = await request(app)
      .get(`/api/v1/matches/jobs/${highMatchJobId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.match).toBeDefined();
    expect(res.body.match.jobId).toBe(highMatchJobId);
    expect(res.body.match.overallScore).toBeGreaterThanOrEqual(80);
    expect(res.body.match.breakdown).toBeDefined();
    expect(res.body.match.matchedSkills).toBeInstanceOf(Array);
  });

  it('6. POST /api/v1/matches/recalculate recalculates score with custom weights', async () => {
    const res = await request(app)
      .post('/api/v1/matches/recalculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        jobId: highMatchJobId,
        weights: {
          requiredSkillsWeight: 0.6,
          seniorityWeight: 0.2,
          locationWeight: 0.2,
          preferredSkillsWeight: 0.0,
          titleWeight: 0.0,
          compensationWeight: 0.0,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.match).toBeDefined();
    expect(res.body.match.overallScore).toBeGreaterThanOrEqual(80);
  });

  it('7. GET /api/v1/matches/top returns ranked matches and respects excludeEliminated filter', async () => {
    // Query with excludeEliminated = true
    const res = await request(app)
      .get('/api/v1/matches/top?limit=10&excludeEliminated=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.matches).toBeInstanceOf(Array);

    // None of the returned jobs should be eliminated
    for (const match of res.body.matches) {
      expect(match.isEliminated).toBe(false);
    }

    // High match job should be in the top ranked positions
    const foundHigh = res.body.matches.find((m: any) => m.jobId === highMatchJobId);
    expect(foundHigh).toBeDefined();
  });
});
