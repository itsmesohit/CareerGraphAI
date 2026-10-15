import { prisma } from '@careergraph/db';
import { ProceduralMemoryService } from './proceduralMemoryService.js';
import type { AutofillPayloadDTO } from '@careergraph/shared';

export class AutofillPayloadService {
  /**
   * Constructs a complete grounded autofill payload for the browser extension or runner.
   */
  static async getAutofillPayload(
    userId: string,
    applicationId: string,
    currentUrl?: string
  ): Promise<AutofillPayloadDTO> {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
      },
    });

    if (!app || app.userId !== userId) {
      throw new Error('Application not found');
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });

    if (!profile) {
      throw new Error('Candidate profile not found');
    }

    // Parse full name into first and last
    const fullName = profile.fullName || profile.user.name || 'Candidate';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Candidate';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // Target URL for procedural selectors
    const targetUrl = currentUrl || app.job.applyUrl || app.job.jobUrl;
    const selectors = await ProceduralMemoryService.getSelectorsForDomain(userId, targetUrl);

    // Prepared tailored bullets
    const tailoredResume = (app.tailoredResumeJson as any) || {};
    const tailoredBullets: string[] = tailoredResume.tailoredBullets || [];

    // Prepared screening answers
    const answers = (app.preparedAnswers as any) || {};

    const location = [profile.locationCity, profile.locationState, profile.locationCountry]
      .filter(Boolean)
      .join(', ');

    return {
      applicationId: app.id,
      jobId: app.jobId,
      company: app.job.company,
      jobTitle: app.job.title,
      applyUrl: app.job.applyUrl || app.job.jobUrl,
      contentHash: app.contentHash || 'PREVIEW_UNHASHED',
      candidate: {
        firstName,
        lastName,
        fullName,
        email: profile.user.email,
        phone: profile.phone || '',
        location: location || '',
        headline: profile.headline || '',
        linkedinUrl: profile.linkedinUrl || '',
        githubUrl: profile.githubUrl || '',
        portfolioUrl: profile.portfolioUrl || '',
      },
      answers,
      tailoredBullets,
      coverLetterText: app.coverLetterText || '',
      proceduralSelectors: selectors,
      generatedAt: new Date().toISOString(),
    };
  }
}
