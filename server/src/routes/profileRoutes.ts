import { Router } from 'express';
import { ProfileService } from '../modules/profile/profileService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const profile = await ProfileService.getProfile(tenantId);
    return res.json({ profile });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const updated = await ProfileService.updateProfile(tenantId, req.body);
    return res.json({ profile: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/resumes', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const resumeText = req.body.text || `Alex Rivera
Senior Full Stack & AI Systems Engineer
Specialized in FalkorDB graph reasoning, Redis, TypeScript, Node.js, and React.
Projects:
- GraphAgent Memory Pipeline: Low latency episodic & semantic memory engine on FalkorDB.
- Autonomous Application Orchestrator: BullMQ background queue and Playwright submissions.
Skills: FalkorDB, TypeScript, React, Node.js, Redis, PostgreSQL, Docker, AI Agents, Playwright.`;

    const result = await ProfileService.parseAndIngestResume(tenantId, resumeText);
    return res.json({
      message: 'Resume parsed and ingested into FalkorDB successfully.',
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
