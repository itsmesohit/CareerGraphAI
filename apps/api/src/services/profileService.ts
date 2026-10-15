import { prisma, VerificationStatus, FactSource } from '@careergraph/db';
import {
  ProfileUpdateInput,
  ExperienceInput,
  EducationInput,
  SkillInput,
  ProjectInput,
  CertificationInput,
  PreferencesInput,
  CandidateAnswerInput,
  ProfileCompletenessDTO,
  ProfileAssetsInput,
  ResumeExtractionResult,
} from '@careergraph/shared';
import { outboxService } from './outboxService.js';

export class ProfileService {
  /**
   * Get or create candidate profile for a user.
   */
  async getOrCreateProfile(userId: string) {
    let profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experiences: { orderBy: { createdAt: 'desc' } },
        educations: { orderBy: { createdAt: 'desc' } },
        skills: { orderBy: { createdAt: 'desc' } },
        projects: { orderBy: { createdAt: 'desc' } },
        certifications: { orderBy: { createdAt: 'desc' } },
        preferences: true,
      },
    });

    if (!profile) {
      // Find user name if available
      const user = await prisma.user.findUnique({ where: { id: userId } });
      profile = await prisma.candidateProfile.create({
        data: {
          userId,
          fullName: user?.name || null,
          completenessScore: 10,
        },
        include: {
          experiences: true,
          educations: true,
          skills: true,
          projects: true,
          certifications: true,
          preferences: true,
        },
      });

      // Also create default preferences
      await prisma.candidatePreferences.create({
        data: {
          profileId: profile.id,
          targetTitles: [],
          targetLocations: [],
          seniorityLevels: ['MID', 'SENIOR'],
          remotePreference: 'REMOTE_FIRST',
          automationMode: 'STRICT_APPROVAL',
        },
      });

      profile = (await prisma.candidateProfile.findUnique({
        where: { id: profile.id },
        include: {
          experiences: true,
          educations: true,
          skills: true,
          projects: true,
          certifications: true,
          preferences: true,
        },
      }))!;
    }

    // Latest-first ordering (Spec §6): most recent experience & education first
    return {
      ...profile,
      experiences: this.sortExperiencesLatestFirst(profile.experiences),
      educations: this.sortEducationsLatestFirst(profile.educations),
    };
  }

  /**
   * Parses a 4-digit year out of free-form date strings like
   * "2021-06", "March 2019", "2019", or "Present" (null).
   */
  private parseYear(value?: string | null): number | null {
    if (!value) return null;
    const match = value.match(/(19|20)\d{2}/);
    return match ? parseInt(match[0], 10) : null;
  }

  /**
   * Sorts experiences latest-first: current roles first, then by most recent
   * end year (fallback start year, fallback creation) descending.
   */
  private sortExperiencesLatestFirst<
    T extends { isCurrent: boolean; startDate?: string | null; endDate?: string | null; createdAt: Date },
  >(items: T[]): T[] {
    return [...items].sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      const aEnd = this.parseYear(a.endDate) ?? this.parseYear(a.startDate) ?? 0;
      const bEnd = this.parseYear(b.endDate) ?? this.parseYear(b.startDate) ?? 0;
      if (aEnd !== bEnd) return bEnd - aEnd;
      const aStart = this.parseYear(a.startDate) ?? 0;
      const bStart = this.parseYear(b.startDate) ?? 0;
      if (aStart !== bStart) return bStart - aStart;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Sorts education latest-first by end year (fallback start year) descending.
   */
  private sortEducationsLatestFirst<
    T extends { startDate?: string | null; endDate?: string | null; createdAt: Date },
  >(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const aEnd = this.parseYear(a.endDate) ?? this.parseYear(a.startDate) ?? 0;
      const bEnd = this.parseYear(b.endDate) ?? this.parseYear(b.startDate) ?? 0;
      if (aEnd !== bEnd) return bEnd - aEnd;
      const aStart = this.parseYear(a.startDate) ?? 0;
      const bStart = this.parseYear(b.startDate) ?? 0;
      if (aStart !== bStart) return bStart - aStart;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Update profile basics (headline, contact, links).
   */
  async updateProfileBasics(userId: string, data: ProfileUpdateInput) {
    const profile = await this.getOrCreateProfile(userId);
    const updated = await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.headline !== undefined && { headline: data.headline }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.locationCity !== undefined && { locationCity: data.locationCity }),
        ...(data.locationState !== undefined && { locationState: data.locationState }),
        ...(data.locationCountry !== undefined && { locationCountry: data.locationCountry }),
        ...(data.linkedinUrl !== undefined && { linkedinUrl: data.linkedinUrl }),
        ...(data.githubUrl !== undefined && { githubUrl: data.githubUrl }),
        ...(data.portfolioUrl !== undefined && { portfolioUrl: data.portfolioUrl }),
      },
      include: {
        experiences: true,
        educations: true,
        skills: true,
        projects: true,
        certifications: true,
        preferences: true,
      },
    });

    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'CANDIDATE_PROFILE',
      aggregateId: userId,
      eventType: 'PROFILE_UPDATED',
      payload: {
        userId,
        fullName: updated.fullName,
        headline: updated.headline,
        completenessScore: updated.completenessScore,
      },
    });

    return updated;
  }

  /**
   * Update profile assets — base cover letter, video introduction URL, and
   * profile picture (Phase 16). Empty strings clear the asset (stored as null).
   */
  async updateAssets(userId: string, data: ProfileAssetsInput) {
    const profile = await this.getOrCreateProfile(userId);

    const updated = await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: {
        ...(data.coverLetterText !== undefined && { coverLetterText: data.coverLetterText || null }),
        ...(data.videoIntroUrl !== undefined && { videoIntroUrl: data.videoIntroUrl || null }),
        ...(data.profilePictureUrl !== undefined && { profilePictureUrl: data.profilePictureUrl || null }),
      },
      include: {
        experiences: true,
        educations: true,
        skills: true,
        projects: true,
        certifications: true,
        preferences: true,
      },
    });

    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'CANDIDATE_PROFILE',
      aggregateId: userId,
      eventType: 'PROFILE_ASSETS_UPDATED',
      payload: {
        userId,
        hasCoverLetter: Boolean(updated.coverLetterText),
        hasVideoIntro: Boolean(updated.videoIntroUrl),
        hasProfilePicture: Boolean(updated.profilePictureUrl),
        completenessScore: updated.completenessScore,
      },
    });

    return {
      ...updated,
      experiences: this.sortExperiencesLatestFirst(updated.experiences),
      educations: this.sortEducationsLatestFirst(updated.educations),
    };
  }

  /**
   * Commit parsed resume facts into profile with UNVERIFIED status for review.
   */
  async commitParsedResume(userId: string, extraction: ResumeExtractionResult) {
    const profile = await this.getOrCreateProfile(userId);

    // 1. Update basic profile info if not already set
    const updateData: any = {
      rawResumeText: extraction.rawText,
      resumeFileName: extraction.fileName,
    };
    if (!profile.fullName && extraction.extractedProfile.fullName) {
      updateData.fullName = extraction.extractedProfile.fullName;
    }
    if (!profile.headline && extraction.extractedProfile.headline) {
      updateData.headline = extraction.extractedProfile.headline;
    }
    if (!profile.phone && extraction.extractedProfile.phone) {
      updateData.phone = extraction.extractedProfile.phone;
    }
    if (!profile.locationCity && extraction.extractedProfile.locationCity) {
      updateData.locationCity = extraction.extractedProfile.locationCity;
      updateData.locationState = extraction.extractedProfile.locationState;
      updateData.locationCountry = extraction.extractedProfile.locationCountry || 'United States';
    }
    if (!profile.linkedinUrl && extraction.extractedProfile.linkedinUrl) {
      updateData.linkedinUrl = extraction.extractedProfile.linkedinUrl;
    }
    if (!profile.githubUrl && extraction.extractedProfile.githubUrl) {
      updateData.githubUrl = extraction.extractedProfile.githubUrl;
    }
    if (!profile.portfolioUrl && extraction.extractedProfile.portfolioUrl) {
      updateData.portfolioUrl = extraction.extractedProfile.portfolioUrl;
    }

    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    // 2. Add Experiences as UNVERIFIED
    for (const exp of extraction.experiences) {
      await prisma.experience.create({
        data: {
          profileId: profile.id,
          company: exp.company,
          title: exp.title,
          location: exp.location,
          employmentType: exp.employmentType,
          startDate: exp.startDate,
          endDate: exp.endDate,
          isCurrent: exp.isCurrent,
          description: exp.description,
          metrics: exp.metrics || [],
          technologies: exp.technologies || [],
          source: FactSource.RESUME_UPLOAD,
          verificationStatus: VerificationStatus.UNVERIFIED,
        },
      });
    }

    // 3. Add Educations as UNVERIFIED
    for (const edu of extraction.educations) {
      await prisma.education.create({
        data: {
          profileId: profile.id,
          institution: edu.institution,
          degree: edu.degree,
          field: edu.field,
          startDate: edu.startDate,
          endDate: edu.endDate,
          gradeOrCgpa: edu.gradeOrCgpa,
          source: FactSource.RESUME_UPLOAD,
          verificationStatus: VerificationStatus.UNVERIFIED,
        },
      });
    }

    // 4. Add Skills as UNVERIFIED (deduplicating against existing)
    const existingSkills = await prisma.skill.findMany({ where: { profileId: profile.id } });
    const existingSkillNames = new Set(existingSkills.map((s) => s.name.toLowerCase()));

    for (const sk of extraction.skills) {
      if (!existingSkillNames.has(sk.name.toLowerCase())) {
        existingSkillNames.add(sk.name.toLowerCase());
        await prisma.skill.create({
          data: {
            profileId: profile.id,
            name: sk.name,
            category: sk.category,
            proficiency: sk.proficiency,
            yearsExperience: sk.yearsExperience,
            source: FactSource.RESUME_UPLOAD,
            verificationStatus: VerificationStatus.UNVERIFIED,
          },
        });
      }
    }

    // 5. Add Projects as UNVERIFIED
    for (const proj of extraction.projects) {
      await prisma.project.create({
        data: {
          profileId: profile.id,
          name: proj.name,
          role: proj.role,
          description: proj.description,
          techStack: proj.techStack || [],
          url: proj.url,
          source: FactSource.RESUME_UPLOAD,
          verificationStatus: VerificationStatus.UNVERIFIED,
        },
      });
    }

    // 6. Add Certifications as UNVERIFIED
    for (const cert of extraction.certifications) {
      await prisma.certification.create({
        data: {
          profileId: profile.id,
          name: cert.name,
          issuer: cert.issuer,
          issueDate: cert.issueDate,
          expiryDate: cert.expiryDate,
          credentialId: cert.credentialId,
          url: cert.url,
          source: FactSource.RESUME_UPLOAD,
          verificationStatus: VerificationStatus.UNVERIFIED,
        },
      });
    }

    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'CANDIDATE_PROFILE',
      aggregateId: userId,
      eventType: 'RESUME_COMMITTED',
      payload: {
        userId,
        fileName: extraction.fileName,
        factsCount:
          (extraction.experiences?.length || 0) +
          (extraction.educations?.length || 0) +
          (extraction.skills?.length || 0) +
          (extraction.projects?.length || 0),
      },
    });

    return this.getOrCreateProfile(userId);
  }

  // ---------------------------------------------------------------------------
  // Experience CRUD
  // ---------------------------------------------------------------------------
  async addExperience(userId: string, data: ExperienceInput) {
    const profile = await this.getOrCreateProfile(userId);
    const exp = await prisma.experience.create({
      data: {
        profileId: profile.id,
        company: data.company,
        title: data.title,
        location: data.location,
        employmentType: data.employmentType,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: data.isCurrent,
        description: data.description,
        metrics: data.metrics,
        technologies: data.technologies,
        source: data.source as FactSource,
        verificationStatus: data.verificationStatus as VerificationStatus,
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'EXPERIENCE',
      aggregateId: exp.id,
      eventType: 'EXPERIENCE_CREATED',
      payload: { ...exp, candidateId: userId },
    });

    return exp;
  }

  async updateExperience(userId: string, id: string, data: Partial<ExperienceInput>) {
    const profile = await this.getOrCreateProfile(userId);
    const updated = await prisma.experience.update({
      where: { id, profileId: profile.id },
      data: {
        ...(data.company !== undefined && { company: data.company }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.isCurrent !== undefined && { isCurrent: data.isCurrent }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.metrics !== undefined && { metrics: data.metrics }),
        ...(data.technologies !== undefined && { technologies: data.technologies }),
        ...(data.verificationStatus !== undefined && {
          verificationStatus: data.verificationStatus as VerificationStatus,
        }),
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'EXPERIENCE',
      aggregateId: updated.id,
      eventType: 'EXPERIENCE_UPDATED',
      payload: { ...updated, candidateId: userId },
    });

    return updated;
  }

  async deleteExperience(userId: string, id: string) {
    const profile = await this.getOrCreateProfile(userId);
    await prisma.experience.delete({ where: { id, profileId: profile.id } });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'EXPERIENCE',
      aggregateId: id,
      eventType: 'EXPERIENCE_DELETED',
      payload: { id, candidateId: userId },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Education CRUD
  // ---------------------------------------------------------------------------
  async addEducation(userId: string, data: EducationInput) {
    const profile = await this.getOrCreateProfile(userId);
    const edu = await prisma.education.create({
      data: {
        profileId: profile.id,
        institution: data.institution,
        degree: data.degree,
        field: data.field,
        startDate: data.startDate,
        endDate: data.endDate,
        gradeOrCgpa: data.gradeOrCgpa,
        source: data.source as FactSource,
        verificationStatus: data.verificationStatus as VerificationStatus,
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'EDUCATION',
      aggregateId: edu.id,
      eventType: 'EDUCATION_CREATED',
      payload: { ...edu, candidateId: userId },
    });

    return edu;
  }

  async updateEducation(userId: string, id: string, data: Partial<EducationInput>) {
    const profile = await this.getOrCreateProfile(userId);
    const updated = await prisma.education.update({
      where: { id, profileId: profile.id },
      data: {
        ...(data.institution !== undefined && { institution: data.institution }),
        ...(data.degree !== undefined && { degree: data.degree }),
        ...(data.field !== undefined && { field: data.field }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.gradeOrCgpa !== undefined && { gradeOrCgpa: data.gradeOrCgpa }),
        ...(data.verificationStatus !== undefined && {
          verificationStatus: data.verificationStatus as VerificationStatus,
        }),
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'EDUCATION',
      aggregateId: updated.id,
      eventType: 'EDUCATION_UPDATED',
      payload: { ...updated, candidateId: userId },
    });

    return updated;
  }

  async deleteEducation(userId: string, id: string) {
    const profile = await this.getOrCreateProfile(userId);
    await prisma.education.delete({ where: { id, profileId: profile.id } });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'EDUCATION',
      aggregateId: id,
      eventType: 'EDUCATION_DELETED',
      payload: { id, candidateId: userId },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Skill CRUD
  // ---------------------------------------------------------------------------
  async addSkill(userId: string, data: SkillInput) {
    const profile = await this.getOrCreateProfile(userId);
    const skill = await prisma.skill.create({
      data: {
        profileId: profile.id,
        name: data.name,
        category: data.category,
        proficiency: data.proficiency,
        yearsExperience: data.yearsExperience,
        source: data.source as FactSource,
        verificationStatus: data.verificationStatus as VerificationStatus,
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'SKILL',
      aggregateId: skill.id,
      eventType: 'SKILL_CREATED',
      payload: { ...skill, candidateId: userId },
    });

    return skill;
  }

  async updateSkill(userId: string, id: string, data: Partial<SkillInput>) {
    const profile = await this.getOrCreateProfile(userId);
    const updated = await prisma.skill.update({
      where: { id, profileId: profile.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.proficiency !== undefined && { proficiency: data.proficiency }),
        ...(data.yearsExperience !== undefined && { yearsExperience: data.yearsExperience }),
        ...(data.verificationStatus !== undefined && {
          verificationStatus: data.verificationStatus as VerificationStatus,
        }),
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'SKILL',
      aggregateId: updated.id,
      eventType: 'SKILL_UPDATED',
      payload: { ...updated, candidateId: userId },
    });

    return updated;
  }

  async deleteSkill(userId: string, id: string) {
    const profile = await this.getOrCreateProfile(userId);
    await prisma.skill.delete({ where: { id, profileId: profile.id } });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'SKILL',
      aggregateId: id,
      eventType: 'SKILL_DELETED',
      payload: { id, candidateId: userId },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------
  async addProject(userId: string, data: ProjectInput) {
    const profile = await this.getOrCreateProfile(userId);
    const proj = await prisma.project.create({
      data: {
        profileId: profile.id,
        name: data.name,
        role: data.role,
        description: data.description,
        techStack: data.techStack,
        url: data.url,
        source: data.source as FactSource,
        verificationStatus: data.verificationStatus as VerificationStatus,
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'PROJECT',
      aggregateId: proj.id,
      eventType: 'PROJECT_CREATED',
      payload: { ...proj, candidateId: userId },
    });

    return proj;
  }

  async updateProject(userId: string, id: string, data: Partial<ProjectInput>) {
    const profile = await this.getOrCreateProfile(userId);
    const updated = await prisma.project.update({
      where: { id, profileId: profile.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.techStack !== undefined && { techStack: data.techStack }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.verificationStatus !== undefined && {
          verificationStatus: data.verificationStatus as VerificationStatus,
        }),
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'PROJECT',
      aggregateId: updated.id,
      eventType: 'PROJECT_UPDATED',
      payload: { ...updated, candidateId: userId },
    });

    return updated;
  }

  async deleteProject(userId: string, id: string) {
    const profile = await this.getOrCreateProfile(userId);
    await prisma.project.delete({ where: { id, profileId: profile.id } });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'PROJECT',
      aggregateId: id,
      eventType: 'PROJECT_DELETED',
      payload: { id, candidateId: userId },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Certification CRUD
  // ---------------------------------------------------------------------------
  async addCertification(userId: string, data: CertificationInput) {
    const profile = await this.getOrCreateProfile(userId);
    const cert = await prisma.certification.create({
      data: {
        profileId: profile.id,
        name: data.name,
        issuer: data.issuer,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        credentialId: data.credentialId,
        url: data.url,
        source: data.source as FactSource,
        verificationStatus: data.verificationStatus as VerificationStatus,
      },
    });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'CERTIFICATION',
      aggregateId: cert.id,
      eventType: 'CERTIFICATION_CREATED',
      payload: { ...cert, candidateId: userId },
    });

    return cert;
  }

  async deleteCertification(userId: string, id: string) {
    const profile = await this.getOrCreateProfile(userId);
    await prisma.certification.delete({ where: { id, profileId: profile.id } });
    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'CERTIFICATION',
      aggregateId: id,
      eventType: 'CERTIFICATION_DELETED',
      payload: { id, candidateId: userId },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Preferences CRUD
  // ---------------------------------------------------------------------------
  async getPreferences(userId: string) {
    const profile = await this.getOrCreateProfile(userId);
    let prefs = await prisma.candidatePreferences.findUnique({
      where: { profileId: profile.id },
    });
    if (!prefs) {
      prefs = await prisma.candidatePreferences.create({
        data: {
          profileId: profile.id,
          targetTitles: [],
          targetLocations: [],
          seniorityLevels: ['MID', 'SENIOR'],
          remotePreference: 'REMOTE_FIRST',
          automationMode: 'STRICT_APPROVAL',
        },
      });
    }
    return prefs;
  }

  async updatePreferences(userId: string, data: PreferencesInput) {
    const profile = await this.getOrCreateProfile(userId);
    const updated = await prisma.candidatePreferences.upsert({
      where: { profileId: profile.id },
      create: {
        profileId: profile.id,
        targetTitles: data.targetTitles,
        seniorityLevels: data.seniorityLevels,
        targetLocations: data.targetLocations,
        remotePreference: data.remotePreference,
        minSalary: data.minSalary,
        expectedSalary: data.expectedSalary,
        currency: data.currency,
        noticePeriodDays: data.noticePeriodDays,
        blockedCompanies: data.blockedCompanies,
        automationMode: data.automationMode as any,
        workAuthCountries: data.workAuthCountries,
        requiresSponsorship: data.requiresSponsorship,
      },
      update: {
        targetTitles: data.targetTitles,
        seniorityLevels: data.seniorityLevels,
        targetLocations: data.targetLocations,
        remotePreference: data.remotePreference,
        minSalary: data.minSalary,
        expectedSalary: data.expectedSalary,
        currency: data.currency,
        noticePeriodDays: data.noticePeriodDays,
        blockedCompanies: data.blockedCompanies,
        automationMode: data.automationMode as any,
        workAuthCountries: data.workAuthCountries,
        requiresSponsorship: data.requiresSponsorship,
      },
    });
    await this.recalculateCompleteness(profile.id);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Fact Verification (Side-by-side verification screen)
  // ---------------------------------------------------------------------------
  async setFactVerification(
    userId: string,
    factType: 'experience' | 'education' | 'skill' | 'project' | 'certification',
    factId: string,
    status: VerificationStatus
  ) {
    const profile = await this.getOrCreateProfile(userId);

    let updatedItem: any = null;
    switch (factType) {
      case 'experience':
        updatedItem = await prisma.experience.update({
          where: { id: factId, profileId: profile.id },
          data: { verificationStatus: status },
        });
        break;
      case 'education':
        updatedItem = await prisma.education.update({
          where: { id: factId, profileId: profile.id },
          data: { verificationStatus: status },
        });
        break;
      case 'skill':
        updatedItem = await prisma.skill.update({
          where: { id: factId, profileId: profile.id },
          data: { verificationStatus: status },
        });
        break;
      case 'project':
        updatedItem = await prisma.project.update({
          where: { id: factId, profileId: profile.id },
          data: { verificationStatus: status },
        });
        break;
      case 'certification':
        updatedItem = await prisma.certification.update({
          where: { id: factId, profileId: profile.id },
          data: { verificationStatus: status },
        });
        break;
    }

    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: factType.toUpperCase(),
      aggregateId: factId,
      eventType: status === VerificationStatus.USER_VERIFIED ? 'FACT_VERIFIED' : 'FACT_UNVERIFIED',
      payload: { id: factId, status, factType, userId },
    });

    return updatedItem;
  }

  async verifyAllFacts(userId: string) {
    const profile = await this.getOrCreateProfile(userId);

    await Promise.all([
      prisma.experience.updateMany({
        where: { profileId: profile.id, verificationStatus: VerificationStatus.UNVERIFIED },
        data: { verificationStatus: VerificationStatus.USER_VERIFIED },
      }),
      prisma.education.updateMany({
        where: { profileId: profile.id, verificationStatus: VerificationStatus.UNVERIFIED },
        data: { verificationStatus: VerificationStatus.USER_VERIFIED },
      }),
      prisma.skill.updateMany({
        where: { profileId: profile.id, verificationStatus: VerificationStatus.UNVERIFIED },
        data: { verificationStatus: VerificationStatus.USER_VERIFIED },
      }),
      prisma.project.updateMany({
        where: { profileId: profile.id, verificationStatus: VerificationStatus.UNVERIFIED },
        data: { verificationStatus: VerificationStatus.USER_VERIFIED },
      }),
      prisma.certification.updateMany({
        where: { profileId: profile.id, verificationStatus: VerificationStatus.UNVERIFIED },
        data: { verificationStatus: VerificationStatus.USER_VERIFIED },
      }),
    ]);

    await this.recalculateCompleteness(profile.id);

    await outboxService.emit({
      aggregateType: 'CANDIDATE_PROFILE',
      aggregateId: userId,
      eventType: 'GRAPH_REBUILD_REQUESTED',
      payload: { userId },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Onboarding State
  // ---------------------------------------------------------------------------
  async getOnboardingState(userId: string) {
    let state = await prisma.onboardingState.findUnique({
      where: { userId },
    });

    if (!state) {
      state = await prisma.onboardingState.create({
        data: {
          userId,
          currentStep: 1,
          isCompleted: false,
          completedSteps: [],
        },
      });
    }

    return state;
  }

  async updateOnboardingState(
    userId: string,
    currentStep: number,
    isCompleted?: boolean,
    completedSteps?: number[]
  ) {
    const existing = await this.getOnboardingState(userId);

    const newCompleted = new Set(existing.completedSteps);
    if (completedSteps) {
      completedSteps.forEach((s) => newCompleted.add(s));
    }
    // Also add the previous step to completed
    if (currentStep > 1) {
      newCompleted.add(currentStep - 1);
    }

    const updated = await prisma.onboardingState.update({
      where: { userId },
      data: {
        currentStep,
        ...(isCompleted !== undefined && { isCompleted }),
        completedSteps: Array.from(newCompleted).sort((a, b) => a - b),
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Canonical Questions & Answers
  // ---------------------------------------------------------------------------
  async getQuestions(query?: { category?: string; coreOnly?: boolean }) {
    const where: any = {};
    if (query?.category) {
      where.category = query.category;
    }
    if (query?.coreOnly !== undefined) {
      where.isCoreOnboarding = query.coreOnly;
    }

    return prisma.canonicalQuestion.findMany({
      where,
      orderBy: [{ isCoreOnboarding: 'desc' }, { category: 'asc' }],
    });
  }

  async saveAnswers(userId: string, answers: CandidateAnswerInput[]) {
    const profile = await this.getOrCreateProfile(userId);

    const results = [];
    for (const ans of answers) {
      const existing = await prisma.candidateAnswer.findFirst({
        where: {
          profileId: profile.id,
          questionKey: ans.questionKey,
          scope: ans.scope as any,
        },
      });

      if (existing) {
        const updated = await prisma.candidateAnswer.update({
          where: { id: existing.id },
          data: {
            value: ans.value,
            verificationStatus: (ans.verificationStatus as VerificationStatus) || VerificationStatus.USER_VERIFIED,
          },
        });
        results.push(updated);
      } else {
        const created = await prisma.candidateAnswer.create({
          data: {
            profileId: profile.id,
            questionKey: ans.questionKey,
            value: ans.value,
            scope: (ans.scope as any) || 'GLOBAL',
            scopeTarget: ans.scopeTarget,
            verificationStatus: (ans.verificationStatus as VerificationStatus) || VerificationStatus.USER_VERIFIED,
          },
        });
        results.push(created);
      }
    }

    await this.recalculateCompleteness(profile.id);

    for (const ansItem of results) {
      await outboxService.emit({
        aggregateType: 'ANSWER',
        aggregateId: ansItem.id,
        eventType: 'MEMORY_CREATED',
        payload: {
          candidateId: userId,
          memoryType: 'EPISODIC',
          title: `Answer: ${ansItem.questionKey}`,
          content: typeof ansItem.value === 'string' ? ansItem.value : JSON.stringify(ansItem.value),
          source: 'QUESTIONNAIRE',
        },
      });
    }

    return results;
  }

  async getAnswers(userId: string) {
    const profile = await this.getOrCreateProfile(userId);
    return prisma.candidateAnswer.findMany({
      where: { profileId: profile.id },
      include: { canonicalQuestion: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Profile Completeness Engine
  // ---------------------------------------------------------------------------
  async getCompleteness(userId: string): Promise<ProfileCompletenessDTO> {
    const profile = await this.getOrCreateProfile(userId);
    return this.calculateCompletenessStats(profile);
  }

  private async recalculateCompleteness(profileId: string) {
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: profileId },
      include: {
        experiences: true,
        educations: true,
        skills: true,
        projects: true,
        certifications: true,
        preferences: true,
      },
    });
    if (!profile) return;

    const stats = this.calculateCompletenessStats(profile);
    await prisma.candidateProfile.update({
      where: { id: profileId },
      data: { completenessScore: stats.score },
    });
  }

  private calculateCompletenessStats(profile: any): ProfileCompletenessDTO {
    let basicsScore = 0;
    const missing: string[] = [];
    const suggestions: string[] = [];

    // 1. Basics (20%)
    if (profile.fullName) basicsScore += 5;
    else missing.push('Full Legal Name');

    if (profile.headline) basicsScore += 5;
    else missing.push('Professional Headline');

    if (profile.phone) basicsScore += 3;
    else missing.push('Phone Number');

    if (profile.locationCity && profile.locationCountry) basicsScore += 4;
    else missing.push('Location (City/Country)');

    if (profile.linkedinUrl || profile.githubUrl) basicsScore += 3;
    else suggestions.push('Add your LinkedIn or GitHub profile URL for recruiter credibility');

    // 1b. Profile assets (Phase 16): picture, video intro, base cover letter
    if (profile.profilePictureUrl) basicsScore += 2;
    else suggestions.push('Upload a profile picture to personalize applications and recruiter outreach');

    if (profile.videoIntroUrl) basicsScore += 2;
    else suggestions.push('Add a short 60-90s video introduction — recruiters engage far more with video profiles');

    if (profile.coverLetterText) basicsScore += 2;
    else suggestions.push('Save a reusable base cover letter the AI can tailor per application');

    // 2. Experience (25%)
    let expScore = 0;
    const exps = profile.experiences || [];
    if (exps.length > 0) {
      expScore += 10;
      const verifiedExps = exps.filter((e: any) => e.verificationStatus === 'USER_VERIFIED');
      if (verifiedExps.length > 0) expScore += 10;
      const hasMetrics = exps.some((e: any) => e.metrics && e.metrics.length > 0);
      if (hasMetrics) expScore += 5;
      else suggestions.push('Add quantifiable metrics (e.g. "improved latency by 30%") to your roles');
    } else {
      missing.push('Work Experience');
      suggestions.push('Add your recent work experience or upload a resume to extract it automatically');
    }

    // 3. Education (15%)
    let eduScore = 0;
    const edus = profile.educations || [];
    if (edus.length > 0) {
      eduScore += 10;
      const verifiedEdus = edus.filter((e: any) => e.verificationStatus === 'USER_VERIFIED');
      if (verifiedEdus.length > 0) eduScore += 5;
    } else {
      missing.push('Education Degree');
      suggestions.push('Add your university or degree credentials');
    }

    // 4. Skills (15%)
    let skillScore = 0;
    const skills = profile.skills || [];
    if (skills.length >= 3) skillScore += 5;
    if (skills.length >= 7) skillScore += 5;
    const verifiedSkills = skills.filter((s: any) => s.verificationStatus === 'USER_VERIFIED');
    if (verifiedSkills.length >= 5) skillScore += 5;
    if (skills.length < 5) {
      suggestions.push('Add at least 5 technical skills to improve job matching precision');
    }

    // 5. Preferences (15%)
    let prefScore = 0;
    const prefs = profile.preferences;
    if (prefs) {
      if (prefs.targetTitles && prefs.targetTitles.length > 0) prefScore += 5;
      else missing.push('Target Job Titles');

      if (prefs.targetLocations && prefs.targetLocations.length > 0) prefScore += 3;
      if (prefs.minSalary || prefs.expectedSalary) prefScore += 4;
      else suggestions.push('Set your target compensation range to filter out underpaying roles');

      if (prefs.automationMode) prefScore += 3;
    } else {
      missing.push('Job Preferences');
      suggestions.push('Configure your target job titles, salary, and automation mode');
    }

    // 6. Verification Quality (10%)
    let verifScore = 0;
    const allFacts = [
      ...(profile.experiences || []),
      ...(profile.educations || []),
      ...(profile.skills || []),
      ...(profile.projects || []),
      ...(profile.certifications || []),
    ];

    const unverifiedCount = allFacts.filter((f: any) => f.verificationStatus === 'UNVERIFIED').length;
    if (allFacts.length > 0) {
      const verifiedRatio = (allFacts.length - unverifiedCount) / allFacts.length;
      verifScore = Math.round(verifiedRatio * 10);
      if (unverifiedCount > 0) {
        suggestions.push(`Review and verify ${unverifiedCount} unverified resume fact(s) to build your CareerGraph`);
      }
    }

    const totalScore = Math.min(
      100,
      basicsScore + expScore + eduScore + skillScore + prefScore + verifScore
    );

    return {
      score: totalScore,
      breakdown: {
        basics: basicsScore,
        experience: expScore,
        education: eduScore,
        skills: skillScore,
        preferences: prefScore,
        verification: verifScore,
      },
      unverifiedFactsCount: unverifiedCount,
      missingFields: missing,
      suggestions: suggestions.slice(0, 5),
    };
  }
}

export const profileService = new ProfileService();
