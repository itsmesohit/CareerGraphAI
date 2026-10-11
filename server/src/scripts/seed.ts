import { falkor } from '../db/falkor/falkorClient.js';
import { initializeGraphSchema } from '../db/falkor/schema.js';
import { ProfileService } from '../modules/profile/profileService.js';
import { JobDiscoveryEngine } from '../modules/jobs/jobService.js';
import { ApplicationAgent } from '../agents/applicationAgent.js';
import { OutreachAgent } from '../agents/outreachAgent.js';

async function seed() {
  console.log('🌱 Starting CareerGraph AI Demo Seeding...');
  await falkor.initialize();
  await initializeGraphSchema();

  const tenantId = 'tenant-demo';

  // 1. Candidate Profile & Career Graph
  console.log('1. Seeding candidate profile (Alex Rivera)...');
  await ProfileService.getProfile(tenantId);

  // 2. Discover and Ingest Jobs
  console.log('2. Discovering & Ingesting Jobs from Remotive, Greenhouse, and Lever...');
  const discovery = new JobDiscoveryEngine();
  const jobs = await discovery.discoverJobs(tenantId, { limit: 12 });
  console.log(`   Ingested ${jobs.length} jobs into FalkorDB.`);

  // 3. Initiate Sample Applications to demonstrate the State Machine
  if (jobs.length > 0) {
    console.log('3. Preparing sample applications across state machine stages...');
    // App 1: In AWAITING_APPROVAL state
    const app1 = await ApplicationAgent.prepareApplication(tenantId, jobs[0].id, 'APPROVAL_REQUIRED');
    console.log(`   App 1 created: "${jobs[0].title}" (Status: ${app1.status})`);

    // App 2: In WAITING_FOR_USER state (Missing Info)
    if (jobs.length > 1) {
      const app2 = await ApplicationAgent.prepareApplication(tenantId, jobs[1].id, 'APPROVAL_REQUIRED');
      console.log(`   App 2 created: "${jobs[1].title}" (Status: ${app2.status})`);
    }

    // App 3: Approved & Submitted
    if (jobs.length > 2) {
      const app3 = await ApplicationAgent.prepareApplication(tenantId, jobs[2].id, 'APPROVAL_REQUIRED');
      if (app3.status === 'AWAITING_APPROVAL') {
        await ApplicationAgent.approveApplication(tenantId, app3.id);
        console.log(`   App 3 approved & submitted: "${jobs[2].title}" (Status: SUBMITTED)`);
      }
    }
  }

  // 4. Create Sample Recruiter Outreach Drafts
  console.log('4. Seeding recruiter outreach workspace...');
  await OutreachAgent.createDraft(tenantId, {
    jobId: jobs[0]?.id || 'job_demo_1',
    company: jobs[0]?.company || 'Falkor Dynamics',
    jobTitle: jobs[0]?.title || 'Staff AI Engineer',
    recipientName: 'Sarah Connor',
    recipientEmail: 's.connor@falkordynamics.example.com',
  });

  console.log('✅ Seeding complete! All systems and graph contexts are ready for demo.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
