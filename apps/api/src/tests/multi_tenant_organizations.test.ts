import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';

const app = createApp();

describe('CareerGraph Phase 10: Multi-Tenant Organizations (Colleges & Coaching) (Spec §4, §17, §18)', () => {
  const adminEmail = `org_admin_${Date.now()}@college.edu`;
  const studentEmail = `student_${Date.now()}@college.edu`;
  const password = 'SecurePassword123!';

  let adminToken: string;
  let adminUserId: string;
  let studentToken: string;
  let studentUserId: string;

  let orgId: string;
  let cohortId: string;
  let driveId: string;
  let inviteToken: string;

  beforeAll(async () => {
    // 1. Register Org Admin
    const adminReg = await request(app).post('/api/v1/auth/register').send({
      name: 'Dr. Ramesh Chandra (Placement Dean)',
      email: adminEmail,
      password,
    });
    expect(adminReg.status).toBe(201);
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    adminUserId = adminUser!.id;
    await prisma.user.update({ where: { id: adminUserId }, data: { isEmailVerified: true } });

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: adminEmail,
      password,
    });
    adminToken = adminLogin.body.data.accessToken;

    // 2. Register Student Candidate
    const studentReg = await request(app).post('/api/v1/auth/register').send({
      name: 'Pooja Verma',
      email: studentEmail,
      password,
    });
    expect(studentReg.status).toBe(201);
    const studentUser = await prisma.user.findUnique({ where: { email: studentEmail } });
    studentUserId = studentUser!.id;
    await prisma.user.update({ where: { id: studentUserId }, data: { isEmailVerified: true } });

    // Seed student profile
    await prisma.candidateProfile.create({
      data: {
        userId: studentUserId,
        fullName: 'Pooja Verma',
        headline: 'Computer Science Undergraduate',
        locationCity: 'Bengaluru',
        completenessScore: 85,
      },
    });

    const studentLogin = await request(app).post('/api/v1/auth/login').send({
      email: studentEmail,
      password,
    });
    studentToken = studentLogin.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    if (orgId) {
      await prisma.campusDriveApplication.deleteMany({ where: { drive: { orgId } } }).catch(() => {});
      await prisma.campusDrive.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.cohortMembership.deleteMany({ where: { cohort: { orgId } } }).catch(() => {});
      await prisma.cohort.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.orgInvitation.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.studentConsent.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.orgMembership.deleteMany({ where: { orgId } }).catch(() => {});
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
    await prisma.candidateProfile.deleteMany({ where: { userId: studentUserId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, studentUserId] } } }).catch(() => {});
  });

  it('1. POST /api/v1/organizations creates multi-tenant College with owner membership and seat allocation', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'National Institute of Technology Karnataka',
        slug: `nitk-surathkal-${Date.now()}`,
        type: 'COLLEGE',
        domain: 'nitk.edu.in',
        primaryColor: '#0284c7',
        seatsPurchased: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.organization.id).toBeDefined();
    expect(res.body.organization.type).toBe('COLLEGE');
    expect(res.body.organization.seatsPurchased).toBe(100);
    expect(res.body.organization.seatsUsed).toBe(1); // Owner consumes 1 seat

    orgId = res.body.organization.id;
  });

  it('2. POST /api/v1/organizations/:id/cohorts creates student batches', async () => {
    const res = await request(app)
      .post(`/api/v1/organizations/${orgId}/cohorts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'B.Tech Computer Science 2026',
        department: 'Computer Science',
        gradYear: 2026,
        description: 'Undergraduate engineering cohort specializing in software systems',
      });

    expect(res.status).toBe(201);
    expect(res.body.cohort.name).toBe('B.Tech Computer Science 2026');
    expect(res.body.cohort.gradYear).toBe(2026);
    cohortId = res.body.cohort.id;
  });

  it('3. POST /api/v1/organizations/:id/invitations/bulk-csv dry-run and commit pipelines', async () => {
    const csvContent = `email,name,department,gradYear
aman.gupta@nitk.edu.in,Aman Gupta,Computer Science,2026
sneha.rao@nitk.edu.in,Sneha Rao,Computer Science,2026
invalid-email-address,Bad Row,Computer Science,2026`;

    // 1. Dry run
    const dryRunRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/invitations/bulk-csv`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        csvContent,
        cohortId,
        dryRun: true,
      });

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.report.validCount).toBe(2);
    expect(dryRunRes.body.report.invalidCount).toBe(1);
    expect(dryRunRes.body.report.createdInvitations.length).toBe(0); // Dry-run does not write
    expect(dryRunRes.body.report.errors[0].reason).toContain('Invalid email syntax');

    // 2. Commit single student invite for Pooja
    const singleInvite = await request(app)
      .post(`/api/v1/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: studentEmail,
        name: 'Pooja Verma',
        role: 'CANDIDATE',
        cohortId,
      });

    expect(singleInvite.status).toBe(201);
    expect(singleInvite.body.invitation.token).toBeDefined();
    inviteToken = singleInvite.body.invitation.token;
  });

  it('4. POST /api/v1/organizations/invitations/accept links student to org & cohort and initializes consent', async () => {
    const res = await request(app)
      .post('/api/v1/organizations/invitations/accept')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ token: inviteToken });

    expect(res.status).toBe(200);
    expect(res.body.result.orgId).toBe(orgId);
    expect(res.body.result.role).toBe('CANDIDATE');

    // Verify member exists in org
    const membersRes = await request(app)
      .get(`/api/v1/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(membersRes.status).toBe(200);
    const pooja = membersRes.body.members.find((m: any) => m.userId === studentUserId);
    expect(pooja).toBeDefined();
    expect(pooja.role).toBe('CANDIDATE');
    expect(pooja.cohorts[0].id).toBe(cohortId);
    expect(pooja.consent.shareProfile).toBe(true);
  });

  it('5. Student Consent & Privacy Toggles: granular controls and audit log creation', async () => {
    // 1. Fetch consent
    const getRes = await request(app)
      .get(`/api/v1/organizations/${orgId}/consent`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.consent.shareOffers).toBe(true);

    // 2. Toggle shareOffers to false (privacy preservation on compensation)
    const patchRes = await request(app)
      .patch(`/api/v1/organizations/${orgId}/consent`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        shareOffers: false,
        shareApplications: true,
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.consent.shareOffers).toBe(false);

    // 3. Verify audit log was created
    const audit = await prisma.auditLog.findFirst({
      where: { orgId, userId: studentUserId, action: 'CONSENT_UPDATED' },
    });
    expect(audit).toBeDefined();
  });

  it('6. Campus Placement Drives: posting, student application, and offer management', async () => {
    // 1. Admin creates campus drive
    const driveRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/drives`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Software Development Engineer - Campus 2026',
        companyName: 'Stripe India',
        description: 'Building global economic infrastructure. High-scale Go & Ruby backend systems.',
        roleType: 'Full-Time',
        location: 'Bengaluru / Remote',
        ctcMin: 2800000,
        ctcMax: 3500000,
        currency: 'INR',
        targetCohortIds: [cohortId],
      });

    expect(driveRes.status).toBe(201);
    expect(driveRes.body.drive.companyName).toBe('Stripe India');
    driveId = driveRes.body.drive.id;

    // 2. Student applies
    const applyRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/drives/${driveId}/apply`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        resumeUrl: 'https://careergraph.ai/resumes/pooja-sde.pdf',
        notes: 'Proficient in distributed systems and Go.',
      });

    expect(applyRes.status).toBe(200);

    // 3. Admin advances student to OFFERED
    const statusRes = await request(app)
      .patch(`/api/v1/organizations/${orgId}/drives/${driveId}/applicants/${studentUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'OFFERED',
        offeredCtc: 3200000, // ₹32 LPA
      });

    expect(statusRes.status).toBe(200);
  });

  it('7. Placement Cell Analytics: placement rate, median CTC, skill gaps, and CSV report export', async () => {
    // 1. Get analytics
    const analyticsRes = await request(app)
      .get(`/api/v1/organizations/${orgId}/cohorts/${cohortId}/analytics`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(analyticsRes.status).toBe(200);
    const a = analyticsRes.body.analytics;
    expect(a.cohortId).toBe(cohortId);
    expect(a.totalStudents).toBe(1);
    expect(a.placedStudents).toBe(1);
    expect(a.placementRate).toBe(100);
    expect(a.skillGaps).toBeInstanceOf(Array);
    expect(a.skillGaps.length).toBeGreaterThanOrEqual(2);

    // 2. Export accreditation CSV
    const exportRes = await request(app)
      .get(`/api/v1/organizations/${orgId}/cohorts/${cohortId}/analytics/export`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
    expect(exportRes.text).toContain('B.Tech Computer Science 2026');
    expect(exportRes.text).toContain('Placement Rate');
  });

  it('8. Organization Policies: update automation mode and company restrictions', async () => {
    const policyRes = await request(app)
      .patch(`/api/v1/organizations/${orgId}/policy`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        defaultAutomationMode: 'STRICT_APPROVAL',
        maxDailyApplications: 15,
        blockedCompanies: ['Unverified Crypto Firms', 'Predatory Bootcamps'],
      });

    expect(policyRes.status).toBe(200);
    expect(policyRes.body.organization.maxDailyApplications).toBe(15);
    expect(policyRes.body.organization.blockedCompanies).toContain('Predatory Bootcamps');
  });

  it('9. Member Removal: reclaims seat capacity and revokes org access', async () => {
    const beforeOrg = await prisma.organization.findUnique({ where: { id: orgId } });
    const initialSeatsUsed = beforeOrg!.seatsUsed;

    const removeRes = await request(app)
      .delete(`/api/v1/organizations/${orgId}/members/${studentUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(removeRes.status).toBe(200);

    const afterOrg = await prisma.organization.findUnique({ where: { id: orgId } });
    expect(afterOrg!.seatsUsed).toBe(initialSeatsUsed - 1);
  });
});
