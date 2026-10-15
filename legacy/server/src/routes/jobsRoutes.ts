import { Router } from 'express';
import { OrchestratorAgent } from '../agents/orchestrator.js';
import { JobDiscoveryEngine } from '../modules/jobs/jobService.js';
import { MatchingAgent } from '../agents/matchingAgent.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/search', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const keywords = (req.query.keywords as string) || '';
    const jobs = await OrchestratorAgent.runDiscoveryWorkflow(tenantId, keywords);
    return res.json({ jobs, count: jobs.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/discover', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { keywords } = req.body;
    const jobs = await OrchestratorAgent.runDiscoveryWorkflow(tenantId, keywords);
    return res.json({ message: 'Discovery workflow completed', jobs, count: jobs.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = JobDiscoveryEngine.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/match', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const match = await MatchingAgent.evaluateMatch(tenantId, req.params.id);
    return res.json({ match });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
