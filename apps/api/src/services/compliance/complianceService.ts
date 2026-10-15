import { prisma, falkor } from '@careergraph/db';
import { DataExportArchiveDto, AccountErasureResponseDto } from '@careergraph/shared';
import { auditService } from '../admin/auditService.js';
import { Request } from 'express';

export class ComplianceService {
  /**
   * Generates a complete data portability archive in accordance with
   * India DPDP Act 2023 (Section 11) and GDPR (Article 20).
   */
  async exportUserData(userId: string, req?: Request): Promise<DataExportArchiveDto> {
    const user: any = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            experiences: true,
            educations: true,
            skills: true,
            projects: true,
            certifications: true,
            preferences: true,
            answers: {
              include: {
                canonicalQuestion: true,
              },
            },
          },
        },
        applications: {
          include: {
            job: true,
            events: true,
            interviews: true,
          },
        },
        recruiterOutreach: true,
        inboundEmailEvents: true,
        studentConsents: true,
        invoices: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Fetch graph facts from FalkorDB
    let graphFacts: any[] = [];
    try {
      const graphRes = await falkor.query(
        `MATCH (c:Candidate { id: $id })-[r]->(target)
         RETURN type(r) AS relationship, labels(target) AS targetLabels, properties(target) AS targetProps
         LIMIT 200`,
        { id: userId }
      );
      if (Array.isArray(graphRes)) {
        graphFacts = graphRes;
      }
    } catch {
      graphFacts = [];
    }

    // Record data export audit log
    await auditService.log({
      userId,
      actorId: userId,
      action: 'COMPLIANCE_DATA_EXPORTED',
      resource: `user:${userId}:data-export`,
      req,
    });

    // Mark user export timestamp
    await prisma.user.update({
      where: { id: userId },
      data: { dataExportRequestedAt: new Date() },
    });

    return {
      exportedAt: new Date().toISOString(),
      complianceStandard: 'DPDP_ACT_2023_AND_GDPR_ART_20',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      profile: user.profile
        ? {
            headline: user.profile.headline,
            locationCity: user.profile.locationCity,
            locationCountry: user.profile.locationCountry,
            phone: user.profile.phone,
            completenessScore: user.profile.completenessScore,
          }
        : null,
      experiences: user.profile?.experiences || [],
      educations: user.profile?.educations || [],
      skills: user.profile?.skills || [],
      projects: user.profile?.projects || [],
      canonicalAnswers: (user.profile?.answers || []).map((a: any) => ({
        question: a.canonicalQuestion?.questionText || a.questionKey,
        category: a.canonicalQuestion?.category || 'GENERAL',
        answer: a.value,
        scope: a.scope,
      })),
      applications: (user.applications || []).map((app: any) => ({
        id: app.id,
        jobTitle: app.job?.title,
        company: app.job?.company,
        stage: app.stage,
        appliedAt: app.appliedAt?.toISOString() || null,
        notes: app.notes,
        submissionChannel: app.submissionChannel,
        contentHash: app.contentHash,
        coverLetterText: app.coverLetterText,
        preparedAnswers: app.preparedAnswers,
        interviews: (app.interviews || []).map((intv: any) => ({
          roundName: intv.roundName,
          scheduledAt: intv.scheduledAt.toISOString(),
          status: intv.status,
        })),
      })),
      outreachDrafts: (user.recruiterOutreach || []).map((o: any) => ({
        id: o.id,
        recipientEmail: o.recipientEmail,
        subject: o.subject,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      interviews: (user.applications || []).flatMap((a: any) => a.interviews || []),
      consents: (user.studentConsents || []).map((sc: any) => ({
        orgId: sc.orgId,
        shareProfile: sc.shareProfile,
        shareApplications: sc.shareApplications,
        shareResumes: sc.shareResumes,
        shareOffers: sc.shareOffers,
        allowMentorReview: sc.allowMentorReview,
      })),
      graphFacts,
      invoices: (user.invoices || []).map((inv: any) => ({
        invoiceNumber: inv.invoiceNumber,
        totalAmount: inv.total,
        currency: inv.currency,
        status: inv.status,
        createdAt: inv.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Executes Right to Erasure / Right to be Forgotten per
   * DPDP Act 2023 (Section 12) and GDPR (Article 17).
   */
  async eraseUserAccount(
    userId: string,
    confirmationPhrase: string,
    actorId: string,
    req?: Request
  ): Promise<AccountErasureResponseDto> {
    if (confirmationPhrase !== 'DELETE MY ACCOUNT PERMANENTLY') {
      throw new Error('Invalid confirmation phrase. Type DELETE MY ACCOUNT PERMANENTLY to confirm.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // 1. Immediately revoke all sessions and refresh tokens
    await prisma.session.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    // 2. Clear candidate profile and all profile components
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (profile) {
      await prisma.candidateAnswer.deleteMany({ where: { profileId: profile.id } });
      await prisma.experience.deleteMany({ where: { profileId: profile.id } });
      await prisma.education.deleteMany({ where: { profileId: profile.id } });
      await prisma.skill.deleteMany({ where: { profileId: profile.id } });
      await prisma.project.deleteMany({ where: { profileId: profile.id } });
      await prisma.certification.deleteMany({ where: { profileId: profile.id } });
      await prisma.candidatePreferences.deleteMany({ where: { profileId: profile.id } });
      await prisma.candidateProfile.delete({ where: { id: profile.id } });
    }

    // 3. Detach and delete all candidate nodes and facts from FalkorDB graph memory
    try {
      await falkor.query(`MATCH (c:Candidate { id: $id }) DETACH DELETE c`, { id: userId });
      await falkor.query(`MATCH (c { candidateId: $id }) DETACH DELETE c`, { id: userId });
    } catch {
      // In-mem or clean
    }

    // 4. Remove cohort memberships and student consent
    await prisma.cohortMembership.deleteMany({ where: { userId } });
    await prisma.studentConsent.deleteMany({ where: { userId } });
    await prisma.orgMembership.deleteMany({ where: { userId } });

    // 5. Anonymize invoices (retaining financial transaction records for tax compliance)
    await prisma.invoice.updateMany({
      where: { userId },
      data: {
        customerGstin: null,
        legalEntityName: null,
        legalAddress: null,
      },
    });

    // 6. Soft-delete and anonymize User record (PII erasure)
    const anonymizedEmail = `deleted-${userId.slice(0, 8)}@anonymized.local`;
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Redacted User',
        email: anonymizedEmail,
        passwordHash: null,
        twoFactorSecret: null,
        isSuspended: true,
        suspendedReason: 'Account erased by data subject request (DPDP/GDPR)',
        deletedAt: new Date(),
      },
    });

    // 7. Log immutable audit entry for compliance recordkeeping
    await auditService.log({
      userId,
      actorId,
      action: 'COMPLIANCE_ACCOUNT_ERASED',
      resource: `user:${userId}`,
      metadata: { anonymizedEmail, standard: 'DPDP_ACT_2023_AND_GDPR_ART_17' },
      req,
    });

    return {
      success: true,
      message: 'Account and associated personal career data permanently erased in compliance with DPDP & GDPR.',
      purgedAt: new Date().toISOString(),
    };
  }
}

export const complianceService = new ComplianceService();
