import { Router } from 'express';
import { ApplicationAgent } from '../agents/applicationAgent.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const apps = ApplicationAgent.getApplications(tenantId);
    const submittedCount = apps.filter(a => a.status === 'SUBMITTED').length;
    const pendingCount = apps.filter(a => a.status === 'AWAITING_APPROVAL' || a.status === 'WAITING_FOR_USER').length;

    return res.json({
      plan: 'PRO',
      status: 'ACTIVE',
      quotas: {
        dailyApplications: {
          used: submittedCount,
          limit: 25,
          remaining: Math.max(0, 25 - submittedCount),
        },
        monthlyAiTokens: {
          used: 18450,
          limit: 100000,
          remaining: 81550,
        },
        discoveryRuns: {
          used: 12,
          limit: 50,
        }
      },
      stats: {
        totalApplications: apps.length,
        submitted: submittedCount,
        pendingReview: pendingCount,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
