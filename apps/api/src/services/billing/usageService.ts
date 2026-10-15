import { prisma } from '@careergraph/db';
import { PlanService } from './planService.js';
import { UsageSummaryDto, UsageQuotaItem } from '@careergraph/shared';

export type UsageResourceType =
  | 'discoveryRuns'
  | 'applicationsPrepared'
  | 'autoAppliesExecuted'
  | 'tailoredResumes'
  | 'outreachEmails'
  | 'aiTokens';

export class UsageService {
  /**
   * Helper to format current UTC date as YYYY-MM-DD.
   */
  static getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Finds or creates today's usage meter for the user.
   */
  static async getOrCreateTodayMeter(userId: string) {
    const today = this.getTodayDateString();

    return prisma.dailyUsageMeter.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {},
      create: {
        userId,
        date: today,
      },
    });
  }

  /**
   * Atomically increments a usage resource for the given user.
   */
  static async incrementUsage(
    userId: string,
    resource: UsageResourceType,
    amount: number = 1
  ): Promise<void> {
    const today = this.getTodayDateString();

    const updateField: Record<string, any> = {};
    if (resource === 'discoveryRuns') updateField.discoveryRuns = { increment: amount };
    else if (resource === 'applicationsPrepared') updateField.applicationsPrepared = { increment: amount };
    else if (resource === 'autoAppliesExecuted') updateField.autoAppliesExecuted = { increment: amount };
    else if (resource === 'tailoredResumes') updateField.tailoredResumes = { increment: amount };
    else if (resource === 'outreachEmails') updateField.outreachEmailsSent = { increment: amount };
    else if (resource === 'aiTokens') updateField.aiTokensUsed = { increment: amount };

    await prisma.dailyUsageMeter.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: updateField,
      create: {
        userId,
        date: today,
        discoveryRuns: resource === 'discoveryRuns' ? amount : 0,
        applicationsPrepared: resource === 'applicationsPrepared' ? amount : 0,
        autoAppliesExecuted: resource === 'autoAppliesExecuted' ? amount : 0,
        tailoredResumes: resource === 'tailoredResumes' ? amount : 0,
        outreachEmailsSent: resource === 'outreachEmails' ? amount : 0,
        aiTokensUsed: resource === 'aiTokens' ? amount : 0,
      },
    });
  }

  /**
   * Calculates a quota meter item (used, limit, remaining, percentage).
   */
  static computeQuotaItem(used: number, limit: number): UsageQuotaItem {
    const remaining = Math.max(0, limit - used);
    const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : used > 0 ? 100 : 0;
    return {
      used,
      limit,
      remaining,
      percentage,
    };
  }

  /**
   * Retrieves full usage summary and quota meters for a user against their active plan.
   */
  static async getUsageSummary(userId: string): Promise<UsageSummaryDto> {
    // 1. Fetch active subscription and plan
    const activeSub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
        currentPeriodEnd: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const plan = activeSub
      ? PlanService.toDto(activeSub.plan)
      : await PlanService.getPlanByKey('FREE');

    const entitlements = plan.entitlements;

    // 2. Daily meters (resets each day)
    const today = this.getTodayDateString();
    const todayMeter = await prisma.dailyUsageMeter.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    const dailyDiscoveryUsed = todayMeter?.discoveryRuns || 0;
    const dailyOutreachUsed = todayMeter?.outreachEmailsSent || 0;

    // 3. Monthly meters (sum of current billing period, or last 30 days for Free)
    const periodStart = activeSub ? activeSub.currentPeriodStart : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const startDateStr = periodStart.toISOString().slice(0, 10);

    const periodMeters = await prisma.dailyUsageMeter.findMany({
      where: {
        userId,
        date: { gte: startDateStr },
      },
    });

    let monthlyAppsUsed = 0;
    let monthlyAutoAppliesUsed = 0;
    let monthlyTailoredResumesUsed = 0;
    let monthlyAiTokensUsed = 0;

    for (const m of periodMeters) {
      monthlyAppsUsed += m.applicationsPrepared;
      monthlyAutoAppliesUsed += m.autoAppliesExecuted;
      monthlyTailoredResumesUsed += m.tailoredResumes;
      monthlyAiTokensUsed += m.aiTokensUsed;
    }

    return {
      plan,
      subscription: activeSub
        ? {
            id: activeSub.id,
            userId: activeSub.userId,
            orgId: activeSub.orgId,
            planId: activeSub.planId,
            plan,
            provider: activeSub.provider as any,
            status: activeSub.status as any,
            currentPeriodStart: activeSub.currentPeriodStart.toISOString(),
            currentPeriodEnd: activeSub.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
            canceledAt: activeSub.canceledAt?.toISOString(),
            trialEnd: activeSub.trialEnd?.toISOString(),
            seatsCount: activeSub.seatsCount,
            createdAt: activeSub.createdAt.toISOString(),
          }
        : null,
      quotas: {
        discoveryRuns: this.computeQuotaItem(dailyDiscoveryUsed, entitlements.discoveryRunsPerDay),
        applicationsPrepared: this.computeQuotaItem(monthlyAppsUsed, entitlements.preparedApplicationsPerMonth),
        autoAppliesExecuted: this.computeQuotaItem(monthlyAutoAppliesUsed, entitlements.autoApplyAllowancePerMonth),
        tailoredResumes: this.computeQuotaItem(monthlyTailoredResumesUsed, entitlements.tailoredResumesPerMonth),
        outreachEmails: this.computeQuotaItem(dailyOutreachUsed, entitlements.outreachEmailsPerDay),
        aiTokens: this.computeQuotaItem(monthlyAiTokensUsed, entitlements.aiTokensMonthly),
      },
      features: {
        mailboxTracking: entitlements.mailboxTracking,
        extensionAccess: entitlements.extensionAccess,
        exportData: entitlements.exportData,
      },
    };
  }

  /**
   * Checks if a user has sufficient quota for an upcoming operation.
   */
  static async checkQuota(
    userId: string,
    resource: UsageResourceType,
    cost: number = 1
  ): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {
    const summary = await this.getUsageSummary(userId);
    const item = summary.quotas[resource];

    return {
      allowed: item.remaining >= cost,
      remaining: item.remaining,
      limit: item.limit,
      used: item.used,
    };
  }
}
