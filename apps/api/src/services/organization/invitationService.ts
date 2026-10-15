import crypto from 'crypto';
import { prisma, UserRole } from '@careergraph/db';
import {
  OrgInvitationDto,
  BulkCsvReportDto,
  BulkCsvInvitationInput,
} from '@careergraph/shared';

export class InvitationService {
  /**
   * Generates a single student or mentor invitation.
   */
  static async createInvitation(params: {
    orgId: string;
    email: string;
    name?: string | null;
    role?: UserRole;
    cohortId?: string | null;
    invitedByUserId?: string | null;
  }): Promise<OrgInvitationDto> {
    const org = await prisma.organization.findUnique({
      where: { id: params.orgId },
    });

    if (!org) throw new Error('Organization not found');

    if (org.seatsUsed >= org.seatsPurchased) {
      throw new Error(`Seat limit reached (${org.seatsUsed}/${org.seatsPurchased}). Upgrade plan to invite more members.`);
    }

    const email = params.email.trim().toLowerCase();
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const invitation = await prisma.orgInvitation.create({
      data: {
        orgId: params.orgId,
        email,
        name: params.name || null,
        role: params.role || 'CANDIDATE',
        cohortId: params.cohortId || null,
        invitedByUserId: params.invitedByUserId || null,
        token,
        status: 'PENDING',
        expiresAt,
      },
    });

    return this.toDto(invitation);
  }

  /**
   * Bulk CSV invitation processor with dry-run support and validation report.
   */
  static async processBulkCsv(
    orgId: string,
    input: BulkCsvInvitationInput,
    invitedByUserId?: string | null
  ): Promise<BulkCsvReportDto> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) throw new Error('Organization not found');

    const rawLines = input.csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (rawLines.length === 0) {
      throw new Error('CSV is empty');
    }

    // Detect header
    const firstLine = rawLines[0].toLowerCase();
    const hasHeader = firstLine.includes('email');
    const dataLines = hasHeader ? rawLines.slice(1) : rawLines;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors: Array<{ row: number; email?: string; reason: string }> = [];
    const validRows: Array<{ email: string; name?: string; department?: string; gradYear?: number }> = [];
    const seenEmails = new Set<string>();

    // 1. Validate rows
    dataLines.forEach((line, idx) => {
      const rowNum = hasHeader ? idx + 2 : idx + 1;
      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));

      const email = parts[0]?.toLowerCase();
      const name = parts[1] || undefined;
      const department = parts[2] || undefined;
      const gradYear = parts[3] ? parseInt(parts[3], 10) : undefined;

      if (!email) {
        errors.push({ row: rowNum, reason: 'Missing email address' });
        return;
      }

      if (!emailRegex.test(email)) {
        errors.push({ row: rowNum, email, reason: 'Invalid email syntax' });
        return;
      }

      if (seenEmails.has(email)) {
        errors.push({ row: rowNum, email, reason: 'Duplicate email in CSV' });
        return;
      }

      seenEmails.add(email);
      validRows.push({ email, name, department, gradYear });
    });

    // 2. Check seat capacity
    const availableSeats = org.seatsPurchased - org.seatsUsed;
    if (validRows.length > availableSeats) {
      errors.push({
        row: 0,
        reason: `Insufficient seats available (${availableSeats} remaining, but ${validRows.length} valid students in CSV).`,
      });
    }

    // If dryRun, return report without modifying DB
    if (input.dryRun || errors.some((e) => e.row === 0)) {
      return {
        totalRows: dataLines.length,
        validCount: validRows.length,
        invalidCount: errors.length,
        createdInvitations: [],
        errors,
      };
    }

    // 3. Commit invitations
    const createdInvitations: OrgInvitationDto[] = [];
    for (const row of validRows) {
      // Find or assign cohort
      let targetCohortId = input.cohortId || null;

      if (!targetCohortId && (row.department || row.gradYear)) {
        const cohortName = `${row.department || 'Batch'} ${row.gradYear || ''}`.trim();
        const cohort = await prisma.cohort.upsert({
          where: {
            id: `cohort_${orgId}_${cohortName.toLowerCase().replace(/\s+/g, '_')}`,
          },
          update: {},
          create: {
            id: `cohort_${orgId}_${cohortName.toLowerCase().replace(/\s+/g, '_')}`,
            orgId,
            name: cohortName,
            department: row.department || null,
            gradYear: row.gradYear || null,
          },
        });
        targetCohortId = cohort.id;
      }

      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const inv = await prisma.orgInvitation.create({
        data: {
          orgId,
          email: row.email,
          name: row.name || null,
          role: input.role || 'CANDIDATE',
          cohortId: targetCohortId,
          invitedByUserId: invitedByUserId || null,
          token,
          status: 'PENDING',
          expiresAt,
        },
      });

      createdInvitations.push(this.toDto(inv));
    }

    return {
      totalRows: dataLines.length,
      validCount: validRows.length,
      invalidCount: errors.length,
      createdInvitations,
      errors,
    };
  }

  /**
   * Accepts an invitation token, joining the user to the organization & cohort.
   */
  static async acceptInvitation(token: string, userId: string): Promise<{ orgId: string; role: UserRole }> {
    const invitation = await prisma.orgInvitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new Error('Invalid invitation link or token.');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error(`Invitation has already been ${invitation.status.toLowerCase()}.`);
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.orgInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Invitation has expired. Please ask your administrator to resend.');
    }

    // Transactionally link user, assign cohort, create default consent, and mark invitation accepted
    await prisma.$transaction([
      prisma.orgMembership.upsert({
        where: {
          orgId_userId: {
            orgId: invitation.orgId,
            userId,
          },
        },
        update: {
          role: invitation.role,
        },
        create: {
          orgId: invitation.orgId,
          userId,
          role: invitation.role,
        },
      }),

      // Add to cohort if invitation specified one
      ...(invitation.cohortId
        ? [
            prisma.cohortMembership.upsert({
              where: {
                cohortId_userId: {
                  cohortId: invitation.cohortId,
                  userId,
                },
              },
              update: {},
              create: {
                cohortId: invitation.cohortId,
                userId,
              },
            }),
          ]
        : []),

      // Default student consent
      prisma.studentConsent.upsert({
        where: {
          orgId_userId: {
            orgId: invitation.orgId,
            userId,
          },
        },
        update: {},
        create: {
          orgId: invitation.orgId,
          userId,
          shareProfile: true,
          shareApplications: true,
          shareResumes: true,
          shareOffers: true,
          allowMentorReview: true,
        },
      }),

      // Mark invitation accepted
      prisma.orgInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      }),

      // Increment org seatsUsed
      prisma.organization.update({
        where: { id: invitation.orgId },
        data: {
          seatsUsed: { increment: 1 },
        },
      }),
    ]);

    return { orgId: invitation.orgId, role: invitation.role };
  }

  /**
   * Lists invitations for an organization.
   */
  static async listInvitations(orgId: string, status?: string): Promise<OrgInvitationDto[]> {
    const invitations = await prisma.orgInvitation.findMany({
      where: {
        orgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => this.toDto(inv));
  }

  /**
   * Revokes a pending invitation.
   */
  static async revokeInvitation(invitationId: string, orgId: string): Promise<void> {
    await prisma.orgInvitation.updateMany({
      where: { id: invitationId, orgId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
  }

  static toDto(inv: any): OrgInvitationDto {
    return {
      id: inv.id,
      orgId: inv.orgId,
      cohortId: inv.cohortId,
      email: inv.email,
      name: inv.name,
      role: inv.role,
      token: inv.token,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    };
  }
}
