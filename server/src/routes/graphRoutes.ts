import { Router } from 'express';
import { FalkorGraphService } from '../db/falkor/queries.js';
import { OrchestratorAgent } from '../agents/orchestrator.js';
import { falkor } from '../db/falkor/falkorClient.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const graphData = await FalkorGraphService.getCareerGraph(tenantId);
    return res.json({
      graph: graphData,
      mode: falkor.getMode(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/timeline', (req, res) => {
  try {
    const timeline = OrchestratorAgent.getActivityTimeline();
    return res.json({ timeline });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
