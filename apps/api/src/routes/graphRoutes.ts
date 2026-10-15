import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { graphOps, MemoryType, prisma } from '@careergraph/db';
import { outboxService } from '../services/outboxService.js';
import { z } from 'zod';

export const graphRouter = Router();

graphRouter.use(requireAuth);

const RecordMemorySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(5000),
  memoryType: z.enum(['EPISODIC', 'SEMANTIC', 'PROCEDURAL'] as const),
  source: z.string().optional(),
  expiresAt: z.string().optional().nullable(),
});

/**
 * GET /api/v1/graph/nodes
 * Retrieves candidate's personal subgraph (Candidate, Experiences, Skills, Projects, Educations, Memories).
 */
graphRouter.get('/nodes', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const graph = await graphOps.getCandidateGraph(userId);
    return res.json({
      nodes: graph.nodes,
      edges: graph.edges,
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
    });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/graph/stats
 * Retrieves global and engine runtime statistics.
 */
graphRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await graphOps.getStats();
    return res.json({ stats });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/graph/memories
 * Retrieves triple-tier memories (Episodic, Semantic, Procedural) scoped to candidate.
 */
graphRouter.get('/memories', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const memoryType = req.query.type as MemoryType | undefined;
    const memories = await graphOps.getCandidateMemories(userId, memoryType);
    return res.json({ memories, count: memories.length });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/graph/memories
 * Manually or programmatically record a memory node.
 */
graphRouter.post('/memories', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = RecordMemorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        errors: parsed.error.format(),
      });
    }

    const { title, content, memoryType, source, expiresAt } = parsed.data;

    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Emitting through outbox to guarantee transactional consistency
    await outboxService.emit({
      aggregateType: 'MEMORY',
      aggregateId: memoryId,
      eventType: 'MEMORY_CREATED',
      payload: {
        id: memoryId,
        candidateId: userId,
        userId,
        memoryType,
        title,
        content,
        source: source || 'USER_INPUT',
        verificationStatus: 'USER_VERIFIED',
        expiresAt: expiresAt || null,
      },
    });

    // Also project immediately for sub-millisecond API responsiveness
    const memory = await graphOps.recordMemory({
      id: memoryId,
      candidateId: userId,
      memoryType,
      title,
      content,
      source: source || 'USER_INPUT',
      verificationStatus: 'USER_VERIFIED',
      expiresAt: expiresAt || null,
      tenantId: userId,
    });

    return res.status(201).json({ memory });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/graph/evidence-paths
 * Multi-hop query: resolves graph proof paths for job requirements.
 */
graphRouter.get('/evidence-paths', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const jobId = req.query.jobId as string;

    if (!jobId) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Query parameter "jobId" is required to traverse evidence paths.',
      });
    }

    const paths = await graphOps.getMatchEvidencePaths(userId, jobId);
    return res.json({ paths, count: paths.length });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/graph/rebuild
 * Wipes candidate graph and projects all PostgreSQL entities.
 */
graphRouter.post('/rebuild', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await graphOps.rebuildCandidateGraph(userId, prisma);
    return res.json({
      message: 'Candidate career knowledge graph rebuilt successfully.',
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/v1/graph/sync
 * Sweeps any pending outbox events into graph.
 */
graphRouter.post('/sync', async (_req: Request, res: Response) => {
  try {
    const swept = await outboxService.sweepPending(50);
    return res.json({ swept });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});
