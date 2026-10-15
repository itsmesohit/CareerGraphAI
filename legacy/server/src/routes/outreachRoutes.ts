import { Router } from 'express';
import { OutreachAgent } from '../agents/outreachAgent.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/drafts', (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const drafts = OutreachAgent.getDrafts(tenantId);
    return res.json({ drafts });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/drafts', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { jobId, company, jobTitle, recipientName, recipientEmail } = req.body;
    if (!company || !jobTitle || !recipientEmail) {
      return res.status(400).json({ error: 'company, jobTitle, and recipientEmail are required' });
    }

    const draft = await OutreachAgent.createDraft(tenantId, {
      jobId: jobId || 'job_custom',
      company,
      jobTitle,
      recipientName: recipientName || 'Hiring Manager',
      recipientEmail,
    });

    return res.status(201).json({ draft });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/drafts/:id', (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const updated = OutreachAgent.updateDraft(tenantId, req.params.id, req.body);
    return res.json({ draft: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/drafts/:id/approve', (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const approved = OutreachAgent.approveDraft(tenantId, req.params.id);
    return res.json({ message: 'Draft approved. Ready for dispatch.', draft: approved });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/drafts/:id/send', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const sent = await OutreachAgent.sendDraft(tenantId, req.params.id);
    return res.json({ message: 'Outreach email successfully sent.', draft: sent });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
