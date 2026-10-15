import { prisma } from '@careergraph/db';
import { PlanDto, PlanEntitlements } from '@careergraph/shared';

export const SEED_PLANS: Array<{
  key: string;
  name: string;
  description: string;
  tier: 'INDIVIDUAL' | 'ORGANIZATION';
  price: number;
  currency: string;
  interval: 'MONTHLY' | 'ANNUAL' | 'ONE_TIME';
  isPopular: boolean;
  entitlements: PlanEntitlements;
}> = [
  {
    key: 'FREE',
    name: 'Free Starter',
    description: 'Essential career graph memory and human-in-the-loop job tracking.',
    tier: 'INDIVIDUAL',
    price: 0,
    currency: 'INR',
    interval: 'MONTHLY',
    isPopular: false,
    entitlements: {
      discoveryRunsPerDay: 5,
      matchedJobsVisible: 15,
      preparedApplicationsPerMonth: 5,
      autoApplyAllowancePerMonth: 0,
      tailoredResumesPerMonth: 3,
      aiTokensMonthly: 25000,
      outreachEmailsPerDay: 0,
      mailboxTracking: false,
      extensionAccess: false,
      exportData: false,
    },
  },
  {
    key: 'PRO_MONTHLY',
    name: 'Pro Candidate',
    description: 'Full autonomous copilot with assisted apply, cold outreach, and mailbox sync.',
    tier: 'INDIVIDUAL',
    price: 99900, // ₹999.00 in paise
    currency: 'INR',
    interval: 'MONTHLY',
    isPopular: true,
    entitlements: {
      discoveryRunsPerDay: 50,
      matchedJobsVisible: 1000,
      preparedApplicationsPerMonth: 50,
      autoApplyAllowancePerMonth: 20,
      tailoredResumesPerMonth: 50,
      aiTokensMonthly: 250000,
      outreachEmailsPerDay: 25,
      mailboxTracking: true,
      extensionAccess: true,
      exportData: true,
    },
  },
  {
    key: 'PRO_ANNUAL',
    name: 'Pro Candidate (Annual)',
    description: 'Save 20% on the autonomous copilot with unlimited job discovery and priority queues.',
    tier: 'INDIVIDUAL',
    price: 959000, // ₹9,590.00 in paise (~20% off)
    currency: 'INR',
    interval: 'ANNUAL',
    isPopular: false,
    entitlements: {
      discoveryRunsPerDay: 50,
      matchedJobsVisible: 1000,
      preparedApplicationsPerMonth: 50,
      autoApplyAllowancePerMonth: 25,
      tailoredResumesPerMonth: 50,
      aiTokensMonthly: 300000,
      outreachEmailsPerDay: 25,
      mailboxTracking: true,
      extensionAccess: true,
      exportData: true,
    },
  },
  {
    key: 'PREMIUM_MONTHLY',
    name: 'Premium Autonomous',
    description: 'Maximum firepower for aggressive job hunts with 100 auto-applies and 100 cold emails/day.',
    tier: 'INDIVIDUAL',
    price: 249900, // ₹2,499.00 in paise
    currency: 'INR',
    interval: 'MONTHLY',
    isPopular: false,
    entitlements: {
      discoveryRunsPerDay: 200,
      matchedJobsVisible: 5000,
      preparedApplicationsPerMonth: 200,
      autoApplyAllowancePerMonth: 100,
      tailoredResumesPerMonth: 200,
      aiTokensMonthly: 1000000,
      outreachEmailsPerDay: 100,
      mailboxTracking: true,
      extensionAccess: true,
      exportData: true,
    },
  },
  {
    key: 'COLLEGE_SEAT',
    name: 'College Placement Cell',
    description: 'Per-seat institutional license with cohort tracking, mentor reviews, and aggregate reporting.',
    tier: 'ORGANIZATION',
    price: 499900, // ₹4,999.00 in paise per seat / year
    currency: 'INR',
    interval: 'ANNUAL',
    isPopular: false,
    entitlements: {
      discoveryRunsPerDay: 100,
      matchedJobsVisible: 2000,
      preparedApplicationsPerMonth: 100,
      autoApplyAllowancePerMonth: 0, // Colleges prioritize human verification
      tailoredResumesPerMonth: 100,
      aiTokensMonthly: 500000,
      outreachEmailsPerDay: 50,
      mailboxTracking: true,
      extensionAccess: true,
      exportData: true,
    },
  },
  {
    key: 'COACHING_BATCH',
    name: 'Coaching Accelerator',
    description: 'Batch cohort access for bootcamps with portfolio auditing and direct mentor queues.',
    tier: 'ORGANIZATION',
    price: 299900, // ₹2,999.00 in paise
    currency: 'INR',
    interval: 'MONTHLY',
    isPopular: false,
    entitlements: {
      discoveryRunsPerDay: 100,
      matchedJobsVisible: 2000,
      preparedApplicationsPerMonth: 100,
      autoApplyAllowancePerMonth: 10,
      tailoredResumesPerMonth: 100,
      aiTokensMonthly: 500000,
      outreachEmailsPerDay: 50,
      mailboxTracking: true,
      extensionAccess: true,
      exportData: true,
    },
  },
];

export class PlanService {
  /**
   * Ensures default seed plans exist in the database.
   */
  static async ensureDefaultPlans(): Promise<void> {
    for (const seed of SEED_PLANS) {
      await prisma.plan.upsert({
        where: { key: seed.key },
        update: {
          name: seed.name,
          description: seed.description,
          tier: seed.tier,
          price: seed.price,
          currency: seed.currency,
          interval: seed.interval,
          isPopular: seed.isPopular,
          entitlements: seed.entitlements as any,
          isActive: true,
        },
        create: {
          key: seed.key,
          name: seed.name,
          description: seed.description,
          tier: seed.tier,
          price: seed.price,
          currency: seed.currency,
          interval: seed.interval,
          isPopular: seed.isPopular,
          entitlements: seed.entitlements as any,
          isActive: true,
        },
      });
    }
  }

  /**
   * Lists all active plans.
   */
  static async listPlans(tier?: 'INDIVIDUAL' | 'ORGANIZATION'): Promise<PlanDto[]> {
    await this.ensureDefaultPlans();

    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
        ...(tier ? { tier } : {}),
      },
      orderBy: [{ price: 'asc' }],
    });

    return plans.map((p) => this.toDto(p));
  }

  /**
   * Retrieves a plan by unique key.
   */
  static async getPlanByKey(key: string): Promise<PlanDto> {
    await this.ensureDefaultPlans();

    const plan = await prisma.plan.findUnique({
      where: { key },
    });

    if (!plan) {
      throw new Error(`Plan with key "${key}" not found.`);
    }

    return this.toDto(plan);
  }

  /**
   * Retrieves a plan by ID.
   */
  static async getPlanById(id: string): Promise<PlanDto> {
    const plan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new Error(`Plan with ID "${id}" not found.`);
    }

    return this.toDto(plan);
  }

  /**
   * Formats raw Prisma plan to PlanDto.
   */
  static toDto(plan: any): PlanDto {
    return {
      id: plan.id,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      tier: plan.tier,
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      isActive: plan.isActive,
      isPopular: plan.isPopular,
      entitlements: (plan.entitlements as PlanEntitlements) || {
        discoveryRunsPerDay: 5,
        matchedJobsVisible: 10,
        preparedApplicationsPerMonth: 5,
        autoApplyAllowancePerMonth: 0,
        tailoredResumesPerMonth: 3,
        aiTokensMonthly: 25000,
        outreachEmailsPerDay: 0,
        mailboxTracking: false,
        extensionAccess: false,
        exportData: false,
      },
      createdAt: plan.createdAt?.toISOString(),
      updatedAt: plan.updatedAt?.toISOString(),
    };
  }
}
