import { prisma } from '@careergraph/db';
import { CohortDto, CreateCohortInput } from '@careergraph/shared';

export class CohortService {
  /**
   * Creates a new cohort in an organization.
   */
  static async createCohort(orgId: string, input: CreateCohortInput): Promise<CohortDto> {
    const cohort = await prisma.cohort.create({
      data: {
        orgId,
        name: input.name,
        department: input.department || null,
        gradYear: input.gradYear || null,
        description: input.description || null,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return this.toDto(cohort);
  }

  /**
   * Lists all cohorts for an organization with member count.
   */
  static async listCohorts(orgId: string): Promise<CohortDto[]> {
    const cohorts = await prisma.cohort.findMany({
      where: { orgId },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: [{ gradYear: 'desc' }, { name: 'asc' }],
    });

    return cohorts.map((c) => this.toDto(c));
  }

  /**
   * Retrieves single cohort by ID.
   */
  static async getCohort(cohortId: string): Promise<CohortDto> {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!cohort) {
      throw new Error('Cohort not found');
    }

    return this.toDto(cohort);
  }

  /**
   * Adds a student to a cohort.
   */
  static async addStudentToCohort(cohortId: string, userId: string): Promise<void> {
    const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new Error('Cohort not found');

    // Ensure user is an org member
    const membership = await prisma.orgMembership.findUnique({
      where: {
        orgId_userId: {
          orgId: cohort.orgId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('User must be a member of the organization before joining a cohort.');
    }

    await prisma.cohortMembership.upsert({
      where: {
        cohortId_userId: {
          cohortId,
          userId,
        },
      },
      update: {},
      create: {
        cohortId,
        userId,
      },
    });
  }

  /**
   * Removes a student from a cohort.
   */
  static async removeStudentFromCohort(cohortId: string, userId: string): Promise<void> {
    await prisma.cohortMembership.deleteMany({
      where: {
        cohortId,
        userId,
      },
    });
  }

  static toDto(c: any): CohortDto {
    return {
      id: c.id,
      orgId: c.orgId,
      name: c.name,
      department: c.department,
      gradYear: c.gradYear,
      description: c.description,
      memberCount: c._count?.members || 0,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
