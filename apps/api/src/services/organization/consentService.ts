import { prisma } from '@careergraph/db';
import { StudentConsentDto, UpdateStudentConsentInput } from '@careergraph/shared';

export class ConsentService {
  /**
   * Retrieves current consent preferences for a student within an organization.
   */
  static async getConsent(orgId: string, userId: string): Promise<StudentConsentDto> {
    const consent = await prisma.studentConsent.findUnique({
      where: {
        orgId_userId: { orgId, userId },
      },
    });

    if (consent) {
      return this.toDto(consent);
    }

    // Default consent
    return {
      orgId,
      userId,
      shareProfile: true,
      shareApplications: true,
      shareResumes: true,
      shareOffers: true,
      allowMentorReview: true,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Updates student consent toggles and creates an immutable audit log record.
   */
  static async updateConsent(
    orgId: string,
    userId: string,
    input: UpdateStudentConsentInput
  ): Promise<StudentConsentDto> {
    const updated = await prisma.studentConsent.upsert({
      where: {
        orgId_userId: { orgId, userId },
      },
      update: {
        ...(input.shareProfile !== undefined ? { shareProfile: input.shareProfile } : {}),
        ...(input.shareApplications !== undefined ? { shareApplications: input.shareApplications } : {}),
        ...(input.shareResumes !== undefined ? { shareResumes: input.shareResumes } : {}),
        ...(input.shareOffers !== undefined ? { shareOffers: input.shareOffers } : {}),
        ...(input.allowMentorReview !== undefined ? { allowMentorReview: input.allowMentorReview } : {}),
      },
      create: {
        orgId,
        userId,
        shareProfile: input.shareProfile ?? true,
        shareApplications: input.shareApplications ?? true,
        shareResumes: input.shareResumes ?? true,
        shareOffers: input.shareOffers ?? true,
        allowMentorReview: input.allowMentorReview ?? true,
      },
    });

    await prisma.auditLog.create({
      data: {
        orgId,
        userId,
        action: 'CONSENT_UPDATED',
        resource: 'student_consent',
        metadata: input as any,
      },
    });

    return this.toDto(updated);
  }

  static toDto(consent: any): StudentConsentDto {
    return {
      orgId: consent.orgId,
      userId: consent.userId,
      shareProfile: consent.shareProfile,
      shareApplications: consent.shareApplications,
      shareResumes: consent.shareResumes,
      shareOffers: consent.shareOffers,
      allowMentorReview: consent.allowMentorReview,
      updatedAt: consent.updatedAt ? consent.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
