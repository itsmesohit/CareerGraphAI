import { prisma } from '@careergraph/db';
import {
  AdminPlatformStatsDto,
  AdminUserSummaryDto,
  AdminOrgSummaryDto,
  UserRoleEnum,
} from '@careergraph/shared';
import { auditService } from './auditService.js';
import { Request } from 'express';

export class AdminService {
  /**
   * Aggregates platform-wide metrics for the Super-Admin dashboard
   */
  async getPlatformStats(): Promise<AdminPlatformStatsDto> {
    const [
      totalUsers,
      candidatesCount,
      mentorsCount,
      orgAdminsCount,
      superAdminsCount,
      totalOrganizations,
      totalApplications,
      totalJobs,
      totalInvoices,
      paidInvoices,
      activeSessionsCount,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: 'CANDIDATE', deletedAt: null } }),
      prisma.user.count({ where: { role: 'MENTOR', deletedAt: null } }),
      prisma.user.count({ where: { role: { in: ['ORG_ADMIN', 'ORG_OWNER'] }, deletedAt: null } }),
      prisma.user.count({ where: { role: 'SUPER_ADMIN', deletedAt: null } }),
      prisma.organization.count(),
      prisma.application.count(),
      prisma.jobPosting.count(),
      prisma.invoice.count(),
      prisma.invoice.findMany({
        where: { status: 'PAID' },
        select: { total: true },
      }),
      prisma.session.count({
        where: { isRevoked: false, expiresAt: { gt: new Date() } },
      }),
    ]);

    const totalRevenueINR = paidInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);

    return {
      totalUsers,
      candidatesCount,
      mentorsCount,
      orgAdminsCount,
      superAdminsCount,
      totalOrganizations,
      totalApplications,
      totalJobs,
      totalInvoices,
      totalRevenueINR,
      activeSessionsCount,
    };
  }

  /**
   * Lists and searches users with organizational context and suspension status
   */
  async listUsers(params: {
    query?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: AdminUserSummaryDto[]; total: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (params.query) {
      where.OR = [
        { name: { contains: params.query, mode: 'insensitive' } },
        { email: { contains: params.query, mode: 'insensitive' } },
      ];
    }

    if (params.role) {
      where.role = params.role as any;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          memberships: {
            include: { organization: true },
          },
          sessions: {
            orderBy: { lastUsedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers: AdminUserSummaryDto[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as any,
      isEmailVerified: u.isEmailVerified,
      isSuspended: u.isSuspended,
      suspendedReason: u.suspendedReason,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.sessions[0]?.lastUsedAt ? u.sessions[0].lastUsedAt.toISOString() : null,
      organizations: u.memberships.map((m) => m.organization.name),
    }));

    return {
      users: formattedUsers,
      total,
      page,
      limit,
    };
  }

  /**
   * Updates user role (RBAC assignment)
   */
  async updateUserRole(
    targetUserId: string,
    newRole: string,
    actorId: string,
    req?: Request
  ): Promise<AdminUserSummaryDto> {
    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as any },
      include: {
        memberships: { include: { organization: true } },
        sessions: { orderBy: { lastUsedAt: 'desc' }, take: 1 },
      },
    });

    await auditService.log({
      actorId,
      userId: targetUserId,
      action: 'ADMIN_USER_ROLE_UPDATED',
      resource: `user:${targetUserId}`,
      metadata: { newRole },
      req,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
      isEmailVerified: user.isEmailVerified,
      isSuspended: user.isSuspended,
      suspendedReason: user.suspendedReason,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.sessions[0]?.lastUsedAt?.toISOString() || null,
      organizations: user.memberships.map((m) => m.organization.name),
    };
  }

  /**
   * Suspends or restores user account and revokes active sessions if suspended
   */
  async suspendUser(
    targetUserId: string,
    isSuspended: boolean,
    reason: string | undefined | null,
    actorId: string,
    req?: Request
  ): Promise<AdminUserSummaryDto> {
    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isSuspended,
        suspendedReason: isSuspended ? reason || 'Suspended by system administrator' : null,
      },
      include: {
        memberships: { include: { organization: true } },
        sessions: { orderBy: { lastUsedAt: 'desc' }, take: 1 },
      },
    });

    // If suspended, invalidate all active sessions immediately
    if (isSuspended) {
      await prisma.session.updateMany({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await auditService.log({
      actorId,
      userId: targetUserId,
      action: isSuspended ? 'ADMIN_USER_SUSPENDED' : 'ADMIN_USER_UNSUSPENDED',
      resource: `user:${targetUserId}`,
      metadata: { reason },
      req,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
      isEmailVerified: user.isEmailVerified,
      isSuspended: user.isSuspended,
      suspendedReason: user.suspendedReason,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.sessions[0]?.lastUsedAt?.toISOString() || null,
      organizations: user.memberships.map((m) => m.organization.name),
    };
  }

  /**
   * Force revokes all active sessions for a user
   */
  async revokeAllUserSessions(targetUserId: string, actorId: string, req?: Request): Promise<{ revokedCount: number }> {
    const result = await prisma.session.updateMany({
      where: { userId: targetUserId, isRevoked: false },
      data: { isRevoked: true },
    });

    await auditService.log({
      actorId,
      userId: targetUserId,
      action: 'ADMIN_SESSIONS_REVOKED',
      resource: `user:${targetUserId}:sessions`,
      metadata: { revokedCount: result.count },
      req,
    });

    return { revokedCount: result.count };
  }

  /**
   * Lists all organizations with seat capacities and member counts
   */
  async listOrganizations(params: {
    query?: string;
    page?: number;
    limit?: number;
  }): Promise<{ organizations: AdminOrgSummaryDto[]; total: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.query) {
      where.OR = [
        { name: { contains: params.query, mode: 'insensitive' } },
        { slug: { contains: params.query, mode: 'insensitive' } },
      ];
    }

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: { select: { memberships: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    const formattedOrgs: AdminOrgSummaryDto[] = orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: o.type as any,
      seatsPurchased: o.seatsPurchased,
      seatsUsed: o.seatsUsed,
      membersCount: o._count.memberships,
      createdAt: o.createdAt.toISOString(),
    }));

    return {
      organizations: formattedOrgs,
      total,
      page,
      limit,
    };
  }

  /**
   * Overrides organization purchased seats
   */
  async updateOrgSeats(
    orgId: string,
    seatsPurchased: number,
    actorId: string,
    req?: Request
  ): Promise<AdminOrgSummaryDto> {
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { seatsPurchased },
      include: {
        _count: { select: { memberships: true } },
      },
    });

    await auditService.log({
      actorId,
      orgId,
      action: 'ADMIN_ORG_SEATS_UPDATED',
      resource: `org:${orgId}`,
      metadata: { newSeatsPurchased: seatsPurchased },
      req,
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type as any,
      seatsPurchased: org.seatsPurchased,
      seatsUsed: org.seatsUsed,
      membersCount: org._count.memberships,
      createdAt: org.createdAt.toISOString(),
    };
  }
}

export const adminService = new AdminService();
