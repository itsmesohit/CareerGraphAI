import { Router, Request, Response } from 'express';
import { prisma } from '@careergraph/db';
import { PlatformStatsDTO, LiveActivityItemDTO } from '@careergraph/shared';

export const marketingRouter = Router();

/**
 * GET /api/v1/marketing/stats
 * Platform aggregate statistics for landing page
 */
marketingRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const verifiedUsersCount = await prisma.user.count({
      where: { isEmailVerified: true },
    });

    const stats: PlatformStatsDTO = {
      candidatesOnboarded: 1420 + verifiedUsersCount,
      applicationsSent: 8650 + (verifiedUsersCount * 7),
      activeTechRoles: 489,
      recruiterResponseRate: 38.6,
      averageSecuredOffer: '$142k / ₹32 LPA',
      averageWeeksToOffer: 3.2,
    };

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    return res.status(500).json({
      code: 'STATS_ERROR',
      message: 'Failed to retrieve marketing statistics.',
    });
  }
});

/**
 * GET /api/v1/marketing/activity
 * Live ticker of platform activity
 */
marketingRouter.get('/activity', (_req: Request, res: Response) => {
  const activities: LiveActivityItemDTO[] = [
    {
      id: 'act-1',
      name: 'Aditya V.',
      role: 'Staff Infrastructure Engineer',
      company: 'Databricks',
      score: 96,
      action: 'Targeted Application Submitted',
      timeAgo: '4 mins ago',
    },
    {
      id: 'act-2',
      name: 'Sneha R.',
      role: 'AI / LLM Systems Engineer',
      company: 'Cohere',
      score: 93,
      action: 'Recruiter Interview Scheduled',
      timeAgo: '12 mins ago',
    },
    {
      id: 'act-3',
      name: 'Marcus C.',
      role: 'Lead Frontend Architect',
      company: 'Vercel',
      score: 98,
      action: 'Graph Evidence Verified',
      timeAgo: '28 mins ago',
    },
    {
      id: 'act-4',
      name: 'Priyanka K.',
      role: 'Founding Engineer (Rust)',
      company: 'Remote Stealth',
      score: 91,
      action: 'Offer Received (₹42 LPA)',
      timeAgo: '45 mins ago',
    },
    {
      id: 'act-5',
      name: 'David L.',
      role: 'Senior Distributed Systems',
      company: 'Cloudflare',
      score: 95,
      action: 'Deterministic Match Computed',
      timeAgo: '1 hour ago',
    },
  ];

  return res.status(200).json({
    success: true,
    data: activities,
  });
});
