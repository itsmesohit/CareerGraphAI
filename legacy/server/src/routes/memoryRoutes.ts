import { Router } from 'express';
import { FalkorGraphService } from '../db/falkor/queries.js';
import { MemoryAgent } from '../agents/memoryAgent.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/search', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const category = req.query.category as string | undefined;
    const memories = await FalkorGraphService.getMemories(tenantId, category);
    return res.json({ memories });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/feedback', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { questionKey, questionText, correctionText, context } = req.body;
    if (!questionKey || !correctionText) {
      return res.status(400).json({ error: 'questionKey and correctionText required' });
    }

    await MemoryAgent.recordCorrection(tenantId, {
      questionKey,
      questionText: questionText || questionKey,
      correctionText,
      context: context || 'User Feedback Correction',
    });

    return res.json({ message: 'Correction recorded into FalkorDB Episodic & Procedural memory.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/answers', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const answers = await FalkorGraphService.getAnswers(tenantId);
    return res.json({ answers });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
