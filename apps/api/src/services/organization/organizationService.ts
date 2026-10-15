import crypto from 'crypto';
import { prisma, UserRole } from '@careergraph/db';
import {
  OrganizationDto,
  CreateOrganizationInput,
  UpdateOrganizationPolicyInput,
} from '@careergraph/shared';

export class OrganizationService {
  /**
   * Creates a new organization and grants ORG_OWNER role to creator.
   */
  static async createOrganization(
    userId: string,
    input: CreateOrganizationInput
  ): Promise<OrganizationDto> {
    const existing = await prisma.organization.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      throw new Error(`Organization slug "${input.slug}" is already taken.`);
    }

    const org = await prisma.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        type: input.type as any,
        domain: input.domain ? input.domain.toLowerCase().trim() : null,
        primaryColor: input.primaryColor || '#0284c7',
        seatsPurchased: input.seatsPurchased || 50,
        seatsUsed: 1, // Owner occupies 1 seat
        memberships: {
          create: {
            userId,
            role: 'ORG_OWNER',
          },
        },
        auditLogs: {
          create: {
            userId,
            action: 'ORG_CREATED',
            resource: 'organization',
            metadata: { name: input.name, slug: input.slug },
          },
        },
      },
    });

    return this.toDto(org);
  }

  /**
   * Retrieves organization by ID.
   */
  static async getOrganization(orgId: string): Promise<OrganizationDto> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    return this.toDto(org);
  }

  /**
   * Lists all organizations where user is a member.
   */
  static async listUserOrganizations(userId: string): Promise<Array<{ org: OrganizationDto; role: UserRole }>> {
    const memberships = await prisma.orgMembership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      org: this.toDto(m.organization),
      role: m.role,
    }));
  }

  /**
   * Updates organizational policies (automation mode, daily limit, allowed/blocked companies).
   */
  static async updateOrganizationPolicy(
    orgId: string,
    input: UpdateOrganizationPolicyInput,
    userId: string
  ): Promise<OrganizationDto> {
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        defaultAutomationMode: input.defaultAutomationMode as any,
        maxDailyApplications: input.maxDailyApplications,
        requireMentorReview: input.requireMentorReview,
        allowedCompanies: input.allowedCompanies as any,
        blockedCompanies: input.blockedCompanies as any,
        auditLogs: {
          create: {
            userId,
            action: 'POLICY_UPDATED',
            resource: 'organization_policy',
            metadata: input as any,
          },
        },
      },
    });

    return this.toDto(org);
  }

  /**
   * Lists members of an organization with role, cohort, and consent info.
   */
  static async listMembers(
    orgId: string,
    filters?: { role?: UserRole; cohortId?: string }
  ) {
    const memberships = await prisma.orgMembership.findMany({
      where: {
        orgId,
        ...(filters?.role ? { role: filters.role } : {}),
      },
      include: {
        user: {
          include: {
            profile: true,
            cohortMemberships: {
              include: { cohort: true },
            },
            studentConsents: {
              where: { orgId },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => {
      const consent = m.user.studentConsents[0];
      const cohorts = m.user.cohortMemberships.map((cm) => ({
        id: cm.cohort.id,
        name: cm.cohort.name,
        department: cm.cohort.department,
        gradYear: cm.cohort.gradYear,
      }));

      return {
        membershipId: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        headline: consent?.shareProfile !== false ? m.user.profile?.headline : 'Private Profile',
        location: consent?.shareProfile !== false ? m.user.profile?.locationCity : null,
        cohorts,
        consent: consent
          ? {
              shareProfile: consent.shareProfile,
              shareApplications: consent.shareApplications,
              shareResumes: consent.shareResumes,
              shareOffers: consent.shareOffers,
              allowMentorReview: consent.allowMentorReview,
            }
          : {
              shareProfile: true,
              shareApplications: true,
              shareResumes: true,
              shareOffers: true,
              allowMentorReview: true,
            },
      };
    });
  }

  /**
   * Removes member from organization and reclaims seat.
   */
  static async removeMember(orgId: string, targetUserId: string, actorUserId: string): Promise<void> {
    const membership = await prisma.orgMembership.findUnique({
      where: {
        orgId_userId: { orgId, userId: targetUserId },
      },
    });

    if (!membership) {
      throw new Error('Member not found in organization');
    }

    if (membership.role === 'ORG_OWNER') {
      throw new Error('Cannot remove the organization owner');
    }

    await prisma.$transaction([
      prisma.orgMembership.delete({
        where: { id: membership.id },
      }),
      // Remove from org cohorts
      prisma.cohortMembership.deleteMany({
        where: {
          userId: targetUserId,
          cohort: { orgId },
        },
      }),
      // Reclaim seat
      prisma.organization.update({
        where: { id: orgId },
        data: {
          seatsUsed: { decrement: 1 },
        },
      }),
      prisma.auditLog.create({
        data: {
          orgId,
          userId: actorUserId,
          action: 'MEMBER_REMOVED',
          resource: 'org_membership',
          metadata: { targetUserId, role: membership.role },
        },
      }),
    ]);
  }

  static toDto(org: any): OrganizationDto {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      logoUrl: org.logoUrl,
      domain: org.domain,
      primaryColor: org.primaryColor || '#0284c7',
      seatsPurchased: org.seatsPurchased,
      seatsUsed: org.seatsUsed,
      defaultAutomationMode: org.defaultAutomationMode || 'STRICT_APPROVAL',
      maxDailyApplications: org.maxDailyApplications || 25,
      requireMentorReview: org.requireMentorReview || false,
      allowedCompanies: (org.allowedCompanies as string[]) || null,
      blockedCompanies: (org.blockedCompanies as string[]) || null,
      createdAt: org.createdAt.toISOString(),
    };
  }
}
