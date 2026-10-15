import { prisma } from '@careergraph/db';
import { CampusDriveDto, CreateCampusDriveInput } from '@careergraph/shared';

export class CampusDriveService {
  /**
   * Creates an exclusive campus drive or company placement opportunity.
   */
  static async createDrive(orgId: string, input: CreateCampusDriveInput): Promise<CampusDriveDto> {
    const drive = await prisma.campusDrive.create({
      data: {
        orgId,
        title: input.title,
        companyName: input.companyName,
        description: input.description,
        roleType: input.roleType || 'Full-Time',
        location: input.location || null,
        ctcMin: input.ctcMin || null,
        ctcMax: input.ctcMax || null,
        currency: input.currency || 'INR',
        deadline: input.deadline ? new Date(input.deadline) : null,
        targetCohortIds: input.targetCohortIds as any,
        minCgpa: input.minCgpa || null,
        eligibleDepartments: input.eligibleDepartments as any,
        status: 'ACTIVE',
      },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });

    return this.toDto(drive);
  }

  /**
   * Lists drives for an organization, optionally filtered by cohort.
   */
  static async listDrives(orgId: string, cohortId?: string): Promise<CampusDriveDto[]> {
    const drives = await prisma.campusDrive.findMany({
      where: {
        orgId,
        status: 'ACTIVE',
      },
      include: {
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If cohortId specified, filter in-memory based on targetCohortIds
    const filtered = cohortId
      ? drives.filter((d) => {
          const targets = (d.targetCohortIds as string[]) || [];
          return targets.length === 0 || targets.includes(cohortId);
        })
      : drives;

    return filtered.map((d) => this.toDto(d));
  }

  /**
   * Retrieves single drive with full applicant statistics.
   */
  static async getDrive(driveId: string): Promise<CampusDriveDto> {
    const drive = await prisma.campusDrive.findUnique({
      where: { id: driveId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!drive) throw new Error('Campus drive not found');

    return this.toDto(drive);
  }

  /**
   * Candidate applies to an active campus drive.
   */
  static async applyToDrive(
    driveId: string,
    userId: string,
    resumeUrl?: string,
    notes?: string
  ): Promise<void> {
    const drive = await prisma.campusDrive.findUnique({
      where: { id: driveId },
    });

    if (!drive) throw new Error('Campus drive not found');
    if (drive.status !== 'ACTIVE') throw new Error('Drive is closed for applications');

    // Check cohort eligibility if targeted
    const targets = (drive.targetCohortIds as string[]) || [];
    if (targets.length > 0) {
      const userCohorts = await prisma.cohortMembership.findMany({
        where: { userId },
        select: { cohortId: true },
      });
      const userCohortIds = userCohorts.map((uc) => uc.cohortId);
      const isEligible = targets.some((t) => userCohortIds.includes(t));

      if (!isEligible) {
        throw new Error('You are not a member of the eligible cohort for this campus drive.');
      }
    }

    await prisma.campusDriveApplication.upsert({
      where: {
        driveId_userId: { driveId, userId },
      },
      update: {
        resumeUrl: resumeUrl || undefined,
        notes: notes || undefined,
      },
      create: {
        driveId,
        userId,
        status: 'APPLIED',
        resumeUrl: resumeUrl || null,
        notes: notes || null,
      },
    });
  }

  /**
   * Org admin updates applicant stage (SHORTLISTED, INTERVIEWING, OFFERED, REJECTED).
   */
  static async updateApplicationStatus(
    driveId: string,
    targetUserId: string,
    status: string,
    offeredCtc?: number
  ): Promise<void> {
    await prisma.campusDriveApplication.update({
      where: {
        driveId_userId: { driveId, userId: targetUserId },
      },
      data: {
        status,
        offeredCtc: offeredCtc !== undefined ? offeredCtc : undefined,
      },
    });
  }

  /**
   * Lists applicants for a campus drive.
   */
  static async listDriveApplicants(driveId: string) {
    const drive = await prisma.campusDrive.findUnique({
      where: { id: driveId },
      include: {
        applications: {
          include: {
            user: {
              include: {
                profile: true,
                studentConsents: {
                  where: { orgId: driveId },
                },
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
      },
    });

    if (!drive) throw new Error('Drive not found');

    return drive.applications.map((app) => ({
      userId: app.userId,
      name: app.user.name,
      email: app.user.email,
      status: app.status,
      appliedAt: app.appliedAt.toISOString(),
      resumeUrl: app.resumeUrl,
      offeredCtc: app.offeredCtc,
      notes: app.notes,
      headline: app.user.profile?.headline,
      completeness: app.user.profile?.completenessScore || 0,
    }));
  }

  static toDto(d: any): CampusDriveDto {
    return {
      id: d.id,
      orgId: d.orgId,
      title: d.title,
      companyName: d.companyName,
      description: d.description,
      roleType: d.roleType || 'Full-Time',
      location: d.location,
      ctcMin: d.ctcMin,
      ctcMax: d.ctcMax,
      currency: d.currency || 'INR',
      deadline: d.deadline ? d.deadline.toISOString() : null,
      targetCohortIds: (d.targetCohortIds as string[]) || [],
      minCgpa: d.minCgpa,
      status: d.status,
      applicationsCount: d._count?.applications || 0,
      createdAt: d.createdAt.toISOString(),
    };
  }
}
