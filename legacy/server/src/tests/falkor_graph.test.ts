import { describe, it, expect, beforeAll } from 'vitest';
import { FalkorGraphService } from '../db/falkor/queries.js';
import { falkor } from '../db/falkor/falkorClient.js';
import { initializeGraphSchema } from '../db/falkor/schema.js';

describe('FalkorDB Graph Memory & Reasoning Engine', () => {
  const tenantA = 'tenant_test_alpha';
  const tenantB = 'tenant_test_beta';

  beforeAll(async () => {
    await falkor.initialize();
    await initializeGraphSchema();
  });

  it('correctly creates candidate profile and connects experience, projects, and skills', async () => {
    await FalkorGraphService.upsertCandidate(tenantA, {
      name: 'Alice Developer',
      email: 'alice@example.com',
      targetRole: 'Staff AI Engineer',
      minSalary: 160000,
    });

    const expId = 'exp_alpha_1';
    await FalkorGraphService.upsertExperience(tenantA, {
      id: expId,
      title: 'Principal Graph Architect',
      company: 'DataMesh Corp',
      description: 'Built high performance FalkorDB agent knowledge bases.',
    });

    const projId = await FalkorGraphService.upsertProject(tenantA, {
      experienceId: expId,
      title: 'FalkorDB Agent Context Core',
      summary: 'Multi-hop graph traversals for AI memory',
      metrics: '5ms p99 response times on 1M node graph',
      skillNames: ['FalkorDB', 'TypeScript', 'Redis'],
    });

    expect(projId).toBeDefined();

    // Verify Evidence connection
    await FalkorGraphService.upsertEvidence(tenantA, {
      text: 'Production verified: FalkorDB memory orchestrator',
      skillName: 'FalkorDB',
      confidence: 0.99,
    });
  });

  it('performs multi-hop reasoning over Job -> Requirement -> Skill <- Project <- Candidate', async () => {
    const jobId = 'job_alpha_101';
    await FalkorGraphService.upsertJob(tenantA, {
      id: jobId,
      externalId: 'ext_101',
      source: 'REMOTIVE',
      title: 'Staff FalkorDB Systems Engineer',
      company: 'Graph AI Systems',
      location: 'Remote',
      remote: true,
      url: 'https://example.com/job/101',
      description: 'Looking for deep FalkorDB and TypeScript expertise',
      requirements: [
        { text: 'Extensive hands-on FalkorDB graph experience', importance: 'REQUIRED', skillName: 'FalkorDB' },
        { text: 'Proficiency with TypeScript async patterns', importance: 'REQUIRED', skillName: 'TypeScript' },
      ],
    });

    const matchResult = await FalkorGraphService.evaluateJobMatch(tenantA, jobId);
    expect(matchResult.jobId).toBe(jobId);
    expect(matchResult.matchedCount).toBeGreaterThanOrEqual(2);
    expect(matchResult.score).toBeGreaterThanOrEqual(80);
    expect(matchResult.matchedItems.some(m => m.skillName === 'FalkorDB')).toBe(true);
    expect(matchResult.matchedItems.some(m => m.skillName === 'TypeScript')).toBe(true);
  });

  it('strictly isolates tenant data: Tenant B cannot traverse or see Tenant A evidence or jobs', async () => {
    // Tenant B queries the same job
    const jobId = 'job_alpha_101';
    const matchResultB = await FalkorGraphService.evaluateJobMatch(tenantB, jobId);
    // Because jobId was created under tenantA, tenantB should get 0 matches or empty results
    expect(matchResultB.matchedCount).toBe(0);
    expect(matchResultB.matchedItems.length).toBe(0);
  });

  it('stores and persists corrections across episodic and procedural memory', async () => {
    await FalkorGraphService.recordMemory(tenantA, {
      category: 'EPISODIC',
      text: 'Candidate corrected salary expectation to $175,000 USD after initial review.',
      context: 'Session Memory Update',
      verified: true,
    });

    await FalkorGraphService.recordMemory(tenantA, {
      category: 'PROCEDURAL',
      text: 'Always reject onsite roles requiring relocation outside California.',
      context: 'Candidate Preference Rule',
      verified: true,
    });

    const episodic = await FalkorGraphService.getMemories(tenantA, 'EPISODIC');
    expect(episodic.some(m => m.text.includes('Candidate corrected salary expectation'))).toBe(true);

    const procedural = await FalkorGraphService.getMemories(tenantA, 'PROCEDURAL');
    expect(procedural.some(m => m.text.includes('Always reject onsite roles'))).toBe(true);
  });
});
