import { Router } from 'express';
import { ApplicationAgent } from '../agents/applicationAgent.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const apps = ApplicationAgent.getApplications(tenantId);
    return res.json({ applications: apps });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { jobId, mode } = req.body;
    if (!jobId) return res.status(400).json({ error: 'jobId is required' });

    const app = await ApplicationAgent.prepareApplication(tenantId, jobId, mode || 'APPROVAL_REQUIRED');
    return res.status(201).json({ application: app });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/missing-info', (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const items = ApplicationAgent.getMissingItems(tenantId);
    return res.json({ missingItems: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/missing-info/:id/answer', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ error: 'answer is required' });

    const app = await ApplicationAgent.resolveMissingInformation(tenantId, req.params.id, answer);
    return res.json({ message: 'Missing information resolved, workflow resumed.', application: app });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const app = ApplicationAgent.getApplicationById(req.params.id);
    if (!app || app.tenantId !== req.user!.tenantId) {
      return res.status(404).json({ error: 'Application not found' });
    }
    return res.json({ application: app });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/decision', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { decision } = req.body; // 'APPROVE' or 'REJECT'
    if (decision === 'APPROVE') {
      const app = await ApplicationAgent.approveApplication(tenantId, req.params.id);
      return res.json({ message: 'Application approved and submitted.', application: app });
    }
    return res.json({ message: 'Decision recorded.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
