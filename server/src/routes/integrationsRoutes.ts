import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

interface IntegrationStatus {
  id: string;
  name: string;
  category: 'JOB_SOURCE' | 'EMAIL' | 'AUTOMATION';
  status: 'CONNECTED' | 'AVAILABLE' | 'REQUIRES_KEY';
  description: string;
  attribution: string;
}

const INTEGRATIONS: IntegrationStatus[] = [
  {
    id: 'remotive',
    name: 'Remotive API',
    category: 'JOB_SOURCE',
    status: 'CONNECTED',
    description: 'Real-time live remote software engineering job listings feed.',
    attribution: 'Powered by Remotive Public API (Free & Open)',
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse Public Boards',
    category: 'JOB_SOURCE',
    status: 'CONNECTED',
    description: 'Public job boards and application forms metadata.',
    attribution: 'Direct ATS Board Integration',
  },
  {
    id: 'lever',
    name: 'Lever Job Postings',
    category: 'JOB_SOURCE',
    status: 'CONNECTED',
    description: 'Structured Lever-hosted career listings.',
    attribution: 'Direct ATS Integration',
  },
  {
    id: 'adzuna',
    name: 'Adzuna Global Aggregator',
    category: 'JOB_SOURCE',
    status: 'AVAILABLE',
    description: 'Global job market search covering millions of postings.',
    attribution: 'Requires ADZUNA_APP_ID and ADZUNA_APP_KEY',
  },
  {
    id: 'gmail',
    name: 'Gmail Recruiter Outreach (OAuth 2.0)',
    category: 'EMAIL',
    status: 'CONNECTED',
    description: 'Authorized outreach sending with mandatory draft approval.',
    attribution: 'Google Identity OAuth (Scoped: https://www.googleapis.com/auth/gmail.send)',
  },
  {
    id: 'playwright',
    name: 'Playwright Authorized Automation',
    category: 'AUTOMATION',
    status: 'CONNECTED',
    description: 'Local verified headless browser application runner.',
    attribution: 'Compliant with platform automation terms',
  }
];

router.get('/', (req, res) => {
  return res.json({ integrations: INTEGRATIONS });
});

router.post('/:provider/connect', (req, res) => {
  const item = INTEGRATIONS.find(i => i.id === req.params.provider);
  if (!item) return res.status(404).json({ error: 'Provider not found' });
  item.status = 'CONNECTED';
  return res.json({ message: `${item.name} connected successfully.`, integration: item });
});

router.delete('/:provider', (req, res) => {
  const item = INTEGRATIONS.find(i => i.id === req.params.provider);
  if (!item) return res.status(404).json({ error: 'Provider not found' });
  item.status = 'AVAILABLE';
  return res.json({ message: `${item.name} disconnected.`, integration: item });
});

export default router;
