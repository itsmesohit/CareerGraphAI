import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { profileService } from '../services/profileService.js';
import {
  ProfileUpdateInputSchema,
  ExperienceInputSchema,
  EducationInputSchema,
  SkillInputSchema,
  ProjectInputSchema,
  CertificationInputSchema,
  PreferencesInputSchema,
  FactVerificationInputSchema,
  ProfileAssetsInputSchema,
} from '@careergraph/shared';

export const profileRouter = Router();

profileRouter.use(requireAuth);

/**
 * GET /api/v1/profile
 * Get complete candidate profile
 */
profileRouter.get('/', async (req: Request, res: Response) => {
  try {
    const profile = await profileService.getOrCreateProfile(req.user!.userId);
    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * PUT /api/v1/profile
 * Update candidate profile basics
 */
profileRouter.put('/', async (req: Request, res: Response) => {
  try {
    const parsed = ProfileUpdateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid profile data',
        details: parsed.error.flatten(),
      });
    }

    const profile = await profileService.updateProfileBasics(req.user!.userId, parsed.data);
    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * PUT /api/v1/profile/assets
 * Update profile assets: base cover letter, video introduction URL,
 * and profile picture (Phase 16).
 */
profileRouter.put('/assets', async (req: Request, res: Response) => {
  try {
    const parsed = ProfileAssetsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid profile assets data.',
        details: parsed.error.flatten(),
      });
    }

    const profile = await profileService.updateAssets(req.user!.userId, parsed.data);
    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Experience routes
 */
profileRouter.post('/experiences', async (req: Request, res: Response) => {
  try {
    const parsed = ExperienceInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid experience data', details: parsed.error.flatten() });
    }
    const exp = await profileService.addExperience(req.user!.userId, parsed.data);
    return res.status(201).json({ experience: exp });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.put('/experiences/:id', async (req: Request, res: Response) => {
  try {
    const parsed = ExperienceInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid experience data', details: parsed.error.flatten() });
    }
    const exp = await profileService.updateExperience(req.user!.userId, req.params.id, parsed.data);
    return res.json({ experience: exp });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.delete('/experiences/:id', async (req: Request, res: Response) => {
  try {
    await profileService.deleteExperience(req.user!.userId, req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Education routes
 */
profileRouter.post('/educations', async (req: Request, res: Response) => {
  try {
    const parsed = EducationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid education data', details: parsed.error.flatten() });
    }
    const edu = await profileService.addEducation(req.user!.userId, parsed.data);
    return res.status(201).json({ education: edu });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.put('/educations/:id', async (req: Request, res: Response) => {
  try {
    const parsed = EducationInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid education data', details: parsed.error.flatten() });
    }
    const edu = await profileService.updateEducation(req.user!.userId, req.params.id, parsed.data);
    return res.json({ education: edu });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.delete('/educations/:id', async (req: Request, res: Response) => {
  try {
    await profileService.deleteEducation(req.user!.userId, req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Skill routes
 */
profileRouter.post('/skills', async (req: Request, res: Response) => {
  try {
    const parsed = SkillInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid skill data', details: parsed.error.flatten() });
    }
    const skill = await profileService.addSkill(req.user!.userId, parsed.data);
    return res.status(201).json({ skill });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.put('/skills/:id', async (req: Request, res: Response) => {
  try {
    const parsed = SkillInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid skill data', details: parsed.error.flatten() });
    }
    const skill = await profileService.updateSkill(req.user!.userId, req.params.id, parsed.data);
    return res.json({ skill });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.delete('/skills/:id', async (req: Request, res: Response) => {
  try {
    await profileService.deleteSkill(req.user!.userId, req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Project routes
 */
profileRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const parsed = ProjectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid project data', details: parsed.error.flatten() });
    }
    const proj = await profileService.addProject(req.user!.userId, parsed.data);
    return res.status(201).json({ project: proj });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.put('/projects/:id', async (req: Request, res: Response) => {
  try {
    const parsed = ProjectInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid project data', details: parsed.error.flatten() });
    }
    const proj = await profileService.updateProject(req.user!.userId, req.params.id, parsed.data);
    return res.json({ project: proj });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    await profileService.deleteProject(req.user!.userId, req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Certification routes
 */
profileRouter.post('/certifications', async (req: Request, res: Response) => {
  try {
    const parsed = CertificationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid certification data', details: parsed.error.flatten() });
    }
    const cert = await profileService.addCertification(req.user!.userId, parsed.data);
    return res.status(201).json({ certification: cert });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.delete('/certifications/:id', async (req: Request, res: Response) => {
  try {
    await profileService.deleteCertification(req.user!.userId, req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Preferences routes
 */
profileRouter.get('/preferences', async (req: Request, res: Response) => {
  try {
    const preferences = await profileService.getPreferences(req.user!.userId);
    return res.json({ preferences });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.put('/preferences', async (req: Request, res: Response) => {
  try {
    const parsed = PreferencesInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid preferences data', details: parsed.error.flatten() });
    }
    const preferences = await profileService.updatePreferences(req.user!.userId, parsed.data);
    return res.json({ preferences });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Fact Verification routes (Side-by-side verification screen)
 */
profileRouter.patch('/facts/:factType/:factId/verify', async (req: Request, res: Response) => {
  try {
    const { factType, factId } = req.params;
    if (!['experience', 'education', 'skill', 'project', 'certification'].includes(factType)) {
      return res.status(400).json({ code: 'INVALID_FACT_TYPE', message: 'Unsupported fact type' });
    }

    const parsed = FactVerificationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid verification status', details: parsed.error.flatten() });
    }

    const updated = await profileService.setFactVerification(
      req.user!.userId,
      factType as any,
      factId,
      parsed.data.status as any
    );
    return res.json({ item: updated });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

profileRouter.post('/facts/verify-all', async (req: Request, res: Response) => {
  try {
    const result = await profileService.verifyAllFacts(req.user!.userId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * Completeness meter & suggestions
 */
profileRouter.get('/completeness', async (req: Request, res: Response) => {
  try {
    const completeness = await profileService.getCompleteness(req.user!.userId);
    return res.json({ completeness });
  } catch (err: any) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});
