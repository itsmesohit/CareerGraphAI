import { describe, it, expect, beforeAll } from 'vitest';
import { RemotiveAdapter } from '../modules/jobs/adapters/remotiveAdapter.js';
import { GreenhouseAdapter } from '../modules/jobs/adapters/greenhouseAdapter.js';
import { LeverAdapter } from '../modules/jobs/adapters/additionalAdapters.js';
import { JobDiscoveryEngine } from '../modules/jobs/jobService.js';
import { ProfileService } from '../modules/profile/profileService.js';
import { ApplicationAgent } from '../agents/applicationAgent.js';
import { OutreachAgent } from '../agents/outreachAgent.js';
import { falkor } from '../db/falkor/falkorClient.js';
import { initializeGraphSchema } from '../db/falkor/schema.js';

describe('End-to-End Agent Workflow and Discovery Tests', () => {
  const tenantId = 'tenant_workflow_test';

  beforeAll(async () => {
    await falkor.initialize();
    await initializeGraphSchema();
    await ProfileService.getProfile(tenantId);
  });

  it('normalizes multiple job providers into the shared schema', async () => {
    const remotive = new RemotiveAdapter();
    const greenhouse = new GreenhouseAdapter();
    const lever = new LeverAdapter();

    const remotiveJobs = await remotive.searchJobs({ limit: 2 });
    const ghJobs = await greenhouse.searchJobs({});
    const leverJobs = await lever.searchJobs({});

    expect(remotiveJobs.length).toBeGreaterThan(0);
    expect(ghJobs.length).toBeGreaterThan(0);
    expect(leverJobs.length).toBeGreaterThan(0);

    const first = remotiveJobs[0];
    expect(first.id).toBeDefined();
    expect(first.title).toBeDefined();
    expect(first.company).toBeDefined();
    expect(first.extractedSkills.length).toBeGreaterThan(0);
    expect(first.fingerprint).toBeDefined();
  });

  it('detects duplicate job listings through fingerprinting', async () => {
    const engine = new JobDiscoveryEngine();
    const jobs = await engine.discoverJobs(tenantId, { limit: 10 });

    const fingerprints = jobs.map(j => j.fingerprint);
    const uniqueFingerprints = new Set(fingerprints);
    // Every job in the returned list should be unique
    expect(fingerprints.length).toBe(uniqueFingerprints.size);
  });

  it('parses uploaded resume and ingests verified skills and evidence', async () => {
    const resume = `
    Alex Rivera - Senior Full Stack Engineer
    Specialized in FalkorDB, TypeScript, React, Node.js, and Redis.
    Built automated BullMQ background jobs and Docker container networks.
    `;
    const res = await ProfileService.parseAndIngestResume(tenantId, resume);
    expect(res.extractedSkills).toContain('FalkorDB');
    expect(res.extractedSkills).toContain('TypeScript');
    expect(res.extractedFacts.length).toBeGreaterThan(0);
  });

  it('handles missing information workflow: pauses at WAITING_FOR_USER and resumes on answer', async () => {
    const engine = new JobDiscoveryEngine();
    const jobs = await engine.discoverJobs(tenantId, { limit: 5 });
    const targetJob = jobs[0];

    // 1. Prepare application
    const app = await ApplicationAgent.prepareApplication(tenantId, targetJob.id, 'APPROVAL_REQUIRED');
    expect(app.id).toBeDefined();

    // If missing items exist, must be WAITING_FOR_USER
    if (app.missingItems.length > 0) {
      expect(app.status).toBe('WAITING_FOR_USER');

      // 2. Candidate answers the first missing item
      const item = app.missingItems[0];
      const resumedApp = await ApplicationAgent.resolveMissingInformation(
        tenantId,
        item.id,
        'Yes, I led production deployment for 3+ years managing distributed clusters.'
      );
      expect(resumedApp).toBeDefined();
    }
  });

  it('enforces recruiter outreach safety: cannot send without explicit approval and re-approval on edit', async () => {
    const draft = await OutreachAgent.createDraft(tenantId, {
      jobId: 'job_test_outreach',
      company: 'TechFlow Systems',
      jobTitle: 'Senior Graph Engineer',
      recipientName: 'Sarah Connor',
      recipientEmail: 'sarah@techflow.example.com',
    });

    expect(draft.id).toBeDefined();
    expect(draft.approved).toBe(false);

    // Attempting to send unapproved draft MUST throw safety violation error
    await expect(OutreachAgent.sendDraft(tenantId, draft.id)).rejects.toThrow('Safety policy violation');

    // Approve the draft
    OutreachAgent.approveDraft(tenantId, draft.id);
    expect(draft.approved).toBe(true);

    // Editing after approval MUST invalidate approval
    OutreachAgent.updateDraft(tenantId, draft.id, { subject: 'Updated application inquiry' });
    expect(draft.approved).toBe(false);

    // Re-approve and successfully send
    OutreachAgent.approveDraft(tenantId, draft.id);
    const sent = await OutreachAgent.sendDraft(tenantId, draft.id);
    expect(sent.sent).toBe(true);
    expect(sent.sentAt).toBeDefined();
  });
});
