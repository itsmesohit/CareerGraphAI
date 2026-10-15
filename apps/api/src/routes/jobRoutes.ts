import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { jobService } from '../services/jobs/jobService.js';
import {
  JobFilterQuerySchema,
  JobUrlImportSchema,
  SavedSearchSchema,
  JobSourceProviderEnum,
} from '@careergraph/shared';
import { z } from 'zod';

export const jobRouter = Router();

// All job discovery routes require an active candidate or user session
jobRouter.use(requireAuth);

/**
 * GET /api/v1/jobs
 * List & search jobs with faceted filtering, pagination, and sorting.
 */
jobRouter.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = JobFilterQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        errors: parsed.error.format(),
      });
    }

    const result = await jobService.listJobs(parsed.data);
    return res.json({
      jobs: result.jobs,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/jobs/sources
 * Returns source catalog, capabilities, rate limits, and health status.
 */
jobRouter.get('/sources', async (_req: Request, res: Response) => {
  try {
    const sources = await jobService.getSources();
    return res.json({ sources });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/jobs/discover
 * Triggers on-demand discovery across active adapters.
 */
jobRouter.post('/discover', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      sources: z.array(JobSourceProviderEnum).optional(),
      keywords: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        errors: parsed.error.format(),
      });
    }

    const result = await jobService.discoverJobs(parsed.data);
    return res.json({
      message: 'Discovery cycle completed',
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/jobs/import-url
 * Imports a job from a direct URL or pasted description card.
 */
jobRouter.post('/import-url', async (req: Request, res: Response) => {
  try {
    const parsed = JobUrlImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        errors: parsed.error.format(),
      });
    }

    const job = await jobService.importJobUrl(parsed.data, req.user!.userId);
    return res.status(201).json({
      message: 'Job imported successfully',
      job,
    });
  } catch (err: any) {
    return res.status(400).json({ code: 'IMPORT_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/jobs/saved-searches
 * List candidate's saved searches.
 */
jobRouter.get('/saved-searches', async (req: Request, res: Response) => {
  try {
    const savedSearches = await jobService.listSavedSearches(req.user!.userId);
    return res.json({ savedSearches });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/jobs/saved-searches
 * Create a new saved search.
 */
jobRouter.post('/saved-searches', async (req: Request, res: Response) => {
  try {
    const parsed = SavedSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        errors: parsed.error.format(),
      });
    }

    const savedSearch = await jobService.createSavedSearch(req.user!.userId, parsed.data);
    return res.status(201).json({ savedSearch });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/jobs/saved-searches/auto-generate
 * Auto-generate saved searches from profile preferences.
 */
jobRouter.post('/saved-searches/auto-generate', async (req: Request, res: Response) => {
  try {
    const created = await jobService.autoGenerateFromProfile(req.user!.userId);
    return res.json({
      message: `Generated ${created.length} saved searches from your profile preferences`,
      savedSearches: created,
    });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * DELETE /api/v1/jobs/saved-searches/:id
 * Delete a saved search.
 */
jobRouter.delete('/saved-searches/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await jobService.deleteSavedSearch(req.params.id, req.user!.userId);
    if (!deleted) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Saved search not found' });
    }
    return res.json({ message: 'Saved search deleted' });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/jobs/:id
 * Retrieve detailed job posting by ID.
 */
jobRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Job posting not found' });
    }
    return res.json({ job });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/jobs/:id/verify-freshness
 * Re-verifies if a job listing is open.
 */
jobRouter.post('/:id/verify-freshness', async (req: Request, res: Response) => {
  try {
    const result = await jobService.verifyFreshness(req.params.id);
    return res.json({
      message: result.isLive ? 'Listing verified active' : 'Listing is no longer active',
      ...result,
    });
  } catch (err: any) {
    return res.status(404).json({ code: 'NOT_FOUND', message: err.message });
  }
});
