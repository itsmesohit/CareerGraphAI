import { prisma } from '@careergraph/db';
import { AuditLogEntryDto, AuditLogQueryInput, AuditLogResponseDto } from '@careergraph/shared';
import { Request } from 'express';

export interface LogAuditParams {
  actorId?: string | null;
  userId?: string | null;
  orgId?: string | null;
  action: string;
  resource: string;
  metadata?: any;
  req?: Request;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Records an immutable audit log event
   */
  async log(params: LogAuditParams): Promise<void> {
    try {
      const ip = params.ipAddress || (params.req ? (params.req.headers['x-forwarded-for'] as string) || params.req.ip : null);
      const ua = params.userAgent || (params.req ? params.req.headers['user-agent'] : null);

      await prisma.auditLog.create({
        data: {
          actorId: params.actorId || undefined,
          userId: params.userId || undefined,
          orgId: params.orgId || undefined,
          action: params.action,
          resource: params.resource,
          metadata: params.metadata || {},
          ipAddress: ip || undefined,
          userAgent: ua || undefined,
        },
      });
    } catch (err) {
      // Audit log failures should not crash application execution, but must be logged to stderr
      console.error('[AuditService] Failed to record audit event:', err);
    }
  }

  /**
   * Queries audit logs with filtering and pagination
   */
  async queryLogs(input: AuditLogQueryInput): Promise<AuditLogResponseDto> {
    const page = input.page || 1;
    const limit = input.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (input.action) {
      where.action = { contains: input.action, mode: 'insensitive' };
    }
    if (input.resource) {
      where.resource = { contains: input.resource, mode: 'insensitive' };
    }
    if (input.userId) {
      where.userId = input.userId;
    }
    if (input.actorId) {
      where.actorId = input.actorId;
    }
    if (input.fromDate || input.toDate) {
      where.createdAt = {};
      if (input.fromDate) where.createdAt.gte = new Date(input.fromDate);
      if (input.toDate) where.createdAt.lte = new Date(input.toDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const formattedLogs: AuditLogEntryDto[] = logs.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      userId: l.userId,
      orgId: l.orgId,
      action: l.action,
      resource: l.resource,
      metadata: l.metadata,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      createdAt: l.createdAt.toISOString(),
    }));

    return {
      logs: formattedLogs,
      total,
      page,
      limit,
    };
  }
}

export const auditService = new AuditService();
