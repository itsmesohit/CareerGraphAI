import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma, graphOps, OutboxStatus } from '@careergraph/db';
import { outboxService } from '../services/outboxService.js';

const app = createApp();

describe('CareerGraph Phase 3: Graph Memory & Outbox Projection', () => {
  const userAEmail = `candidate_a_${Date.now()}@example.com`;
  const userBEmail = `candidate_b_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  let tokenA: string;
  let userAId: string;
  let tokenB: string;
  let userBId: string;

  beforeAll(async () => {
    // 1. Create User A
    const regA = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Developer',
      email: userAEmail,
      password,
    });
    expect(regA.status).toBe(201);
    const userA = await prisma.user.findUnique({ where: { email: userAEmail } });
    userAId = userA!.id;
    await prisma.user.update({ where: { id: userAId }, data: { isEmailVerified: true } });

    const loginA = await request(app).post('/api/v1/auth/login').send({
      email: userAEmail,
      password,
    });
    expect(loginA.status).toBe(200);
    tokenA = loginA.body.data.accessToken;

    // 2. Create User B (for tenant isolation tests)
    const regB = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Isolation',
      email: userBEmail,
      password,
    });
    expect(regB.status).toBe(201);
    const userB = await prisma.user.findUnique({ where: { email: userBEmail } });
    userBId = userB!.id;
    await prisma.user.update({ where: { id: userBId }, data: { isEmailVerified: true } });

    const loginB = await request(app).post('/api/v1/auth/login').send({
      email: userBEmail,
      password,
    });
    expect(loginB.status).toBe(200);
    tokenB = loginB.body.data.accessToken;

    // Clean initial graph state for both test users
    await graphOps.clearCandidateSubgraph(userAId);
    await graphOps.clearCandidateSubgraph(userBId);
  });

  afterAll(async () => {
    // Cleanup graph & database
    await graphOps.clearCandidateSubgraph(userAId);
    await graphOps.clearCandidateSubgraph(userBId);

    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail] } },
    });
    await prisma.$disconnect();
  });

  it('1. Emits OutboxEvent records upon profile and experience mutations', async () => {
    // Add experience for User A
    const expRes = await request(app)
      .post('/api/v1/profile/experiences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        company: 'Stripe',
        title: 'Staff Engineer',
        startDate: '2021-01-01',
        technologies: ['TypeScript', 'GraphDB', 'Redis'],
        metrics: ['$500M processed'],
      });

    expect(expRes.status).toBe(201);
    const expId = expRes.body.experience.id;

    // Check PostgreSQL OutboxEvent table
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { aggregateId: expId },
    });

    expect(outboxEvents.length).toBeGreaterThan(0);
    expect(outboxEvents[0].eventType).toBe('EXPERIENCE_CREATED');
    expect(['PENDING', 'PROCESSED']).toContain(outboxEvents[0].status);
  });

  it('2. Projects outbox events into graph idempotently and updates status to PROCESSED', async () => {
    // Check if background worker already processed or if sweeper processes it
    const expEvent = await prisma.outboxEvent.findFirst({
      where: {
        eventType: 'EXPERIENCE_CREATED',
        payload: { path: ['candidateId'], equals: userAId },
      },
    });
    expect(expEvent).not.toBeNull();

    // Drain the ENTIRE global pending queue, not just one fixed-size batch.
    // The shared test database accumulates PENDING outbox events from every
    // suite that runs before this one (auth, profile, ats, applications...),
    // so a single small batch can starve this user's events and leave the
    // graph unprojected. The loop is bounded; poison events exit on their own
    // via the attempts >= 5 -> FAILED retry rule.
    for (let i = 0; i < 10; i++) {
      const processed = await outboxService.sweepPending(500);
      if (processed === 0) break;
    }
    const updatedEvent = await prisma.outboxEvent.findUnique({ where: { id: expEvent!.id } });
    expect(updatedEvent!.status).toBe(OutboxStatus.PROCESSED);

    // Call project again on the event to test idempotency
    const secondRun = await outboxService.projectEvent(expEvent!.id);
    expect(secondRun).toBe(true);

    // Verify all pending events for user A are PROCESSED
    const pendingRemaining = await prisma.outboxEvent.findMany({
      where: {
        status: OutboxStatus.PENDING,
        payload: { path: ['candidateId'], equals: userAId },
      },
    });
    expect(pendingRemaining.length).toBe(0);
  });

  it('3. GET /api/v1/graph/nodes retrieves candidate career subgraph', async () => {
    const res = await request(app)
      .get('/api/v1/graph/nodes')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.nodes).toBeInstanceOf(Array);
    expect(res.body.edges).toBeInstanceOf(Array);

    // Should include Candidate and Experience nodes
    const labels = res.body.nodes.map((n: any) => n.labels[0]);
    expect(labels).toContain('Candidate');
    expect(labels).toContain('Experience');

    // Experience should demonstrate technologies as skills
    const edgeTypes = res.body.edges.map((e: any) => e.type);
    expect(edgeTypes).toContain('HAS_EXPERIENCE');
    expect(edgeTypes).toContain('DEMONSTRATES');
  });

  it('4. POST & GET /api/v1/graph/memories implements Triple-Tier Memory Model', async () => {
    // Record Episodic memory
    const mem1 = await request(app)
      .post('/api/v1/graph/memories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        memoryType: 'EPISODIC',
        title: 'Initial Career Onboarding Completed',
        content: 'Candidate verified 4 facts and submitted target salary expectations.',
      });
    expect(mem1.status).toBe(201);

    // Record Procedural memory
    const mem2 = await request(app)
      .post('/api/v1/graph/memories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        memoryType: 'PROCEDURAL',
        title: 'Application Automation Policy',
        content: 'Always require human review if employer score is below 85%.',
      });
    expect(mem2.status).toBe(201);

    // Fetch all memories
    const allMems = await request(app)
      .get('/api/v1/graph/memories')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(allMems.status).toBe(200);
    expect(allMems.body.count).toBeGreaterThanOrEqual(2);

    // Fetch filtered by procedural
    const procMems = await request(app)
      .get('/api/v1/graph/memories?type=PROCEDURAL')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(procMems.status).toBe(200);
    expect(procMems.body.memories.every((m: any) => m.properties.memoryType === 'PROCEDURAL')).toBe(true);
  });

  it('5. GET /api/v1/graph/evidence-paths traverses multi-hop match explanations', async () => {
    // Seed a Job with Requirements in graph engine
    const jobId = `job_fintech_${Date.now()}`;
    await graphOps.projectJob({
      id: jobId,
      company: 'Brex',
      title: 'Senior Distributed Systems Engineer',
      requirements: [
        { description: 'Expertise in TypeScript microservices', skill: 'TypeScript', isHardConstraint: true },
        { description: 'Hands-on experience with Redis caching', skill: 'Redis', isHardConstraint: false },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/graph/evidence-paths?jobId=${jobId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.paths).toBeInstanceOf(Array);
    expect(res.body.paths.length).toBeGreaterThanOrEqual(1);

    const firstPath = res.body.paths[0];
    expect(firstPath.jobId).toBe(jobId);
    expect(firstPath.demonstratedBy).toBeDefined();
    expect(firstPath.demonstratedBy.type).toBe('EXPERIENCE');
    expect(firstPath.confidence).toBeGreaterThan(0.5);
  });

  it('6. POST /api/v1/graph/rebuild reconstructs graph completely from PostgreSQL', async () => {
    // Add another skill in PostgreSQL
    await request(app)
      .post('/api/v1/profile/skills')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Distributed Systems',
        category: 'Engineering',
        proficiency: 'EXPERT',
        yearsExperience: 7,
      });

    // Request full graph rebuild
    const rebuildRes = await request(app)
      .post('/api/v1/graph/rebuild')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(rebuildRes.status).toBe(200);
    expect(rebuildRes.body.nodesProjected).toBeGreaterThanOrEqual(3);

    // Verify candidate graph contains projected nodes
    const graphRes = await request(app)
      .get('/api/v1/graph/nodes')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(graphRes.status).toBe(200);
    const nodeNames = graphRes.body.nodes.map((n: any) => n.properties.name || n.properties.title || n.properties.company);
    expect(nodeNames).toContain('Distributed Systems');
  });

  it('7. Enforces strict Multi-Tenant Isolation between Candidate A and Candidate B', async () => {
    // Query Candidate B's graph
    const resB = await request(app)
      .get('/api/v1/graph/nodes')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);

    // Candidate B should NOT see Candidate A's experience (Stripe) or skills
    const bNodeNames = resB.body.nodes.map((n: any) => n.properties.name || n.properties.company || n.properties.title);
    expect(bNodeNames).not.toContain('Stripe');
    expect(bNodeNames).not.toContain('Distributed Systems');

    // Candidate B should NOT see Candidate A's procedural memories
    const bMemRes = await request(app)
      .get('/api/v1/graph/memories')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(bMemRes.status).toBe(200);
    const bMemTitles = bMemRes.body.memories.map((m: any) => m.properties.title);
    expect(bMemTitles).not.toContain('Application Automation Policy');
  });

  it('8. GET /api/v1/graph/stats returns engine mode and telemetry metrics', async () => {
    const res = await request(app)
      .get('/api/v1/graph/stats')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(['LIVE', 'IN_MEMORY']).toContain(res.body.stats.mode);
    expect(res.body.stats.totalNodes).toBeGreaterThan(0);
    expect(res.body.stats.nodeCountsByLabel).toBeDefined();
  });
});
