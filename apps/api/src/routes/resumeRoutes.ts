import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/authMiddleware.js';
import { resumeParserService } from '../services/resumeParserService.js';
import { profileService } from '../services/profileService.js';
import { AtsService } from '../services/ats/atsService.js';
import { AtsCheckRequestSchema } from '@careergraph/shared';

export const resumeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
    ];
    const name = file.originalname.toLowerCase();
    if (
      allowed.includes(file.mimetype) ||
      name.endsWith('.pdf') ||
      name.endsWith('.docx') ||
      name.endsWith('.txt') ||
      name.endsWith('.md')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload a PDF, DOCX, or text file.'));
    }
  },
});

/**
 * POST /api/v1/resumes/upload
 * Parse uploaded resume and populate UNVERIFIED facts into Candidate Profile
 */
resumeRouter.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          code: 'FILE_REQUIRED',
          message: 'Please attach a resume file in PDF, DOCX, or text format.',
        });
      }

      const rawText = await resumeParserService.extractText(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      if (!rawText || rawText.trim().length === 0) {
        return res.status(400).json({
          code: 'EMPTY_FILE',
          message: 'Could not extract any readable text from the uploaded file.',
        });
      }

      // Parse structured entities
      const extracted = await resumeParserService.parseStructured(
        rawText,
        req.file.originalname
      );

      // Commit into profile as UNVERIFIED facts
      const profile = await profileService.commitParsedResume(req.user!.userId, extracted);

      // Fire-and-forget: every uploaded resume immediately gets its latest
      // ATS score computed & persisted on the profile (Phase 16).
      AtsService.checkResume(req.user!.userId).catch((err) =>
        console.warn('[ResumeUpload] ATS auto-check failed:', err.message)
      );

      return res.status(200).json({
        fileName: req.file.originalname,
        rawText,
        extracted,
        profile,
      });
    } catch (err: any) {
      console.error('Resume upload error:', err);
      return res.status(500).json({
        code: 'UPLOAD_FAILED',
        message: err.message || 'Failed to process resume file.',
      });
    }
  }
);

/**
 * POST /api/v1/resumes/ats-check
 * Run the ATS checker over the latest stored resume: computes the 7-category
 * score, persists the latest score/grade/report on the profile, and returns
 * improvement suggestions tuned to the candidate's profile & target job.
 */
resumeRouter.post('/ats-check', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = AtsCheckRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid ATS check request.',
        details: parsed.error.flatten(),
      });
    }

    const report = await AtsService.checkResume(req.user!.userId, parsed.data);
    return res.json({ report });
  } catch (err: any) {
    if (err.status === 400) {
      return res.status(400).json({ code: err.code || 'NO_RESUME', message: err.message });
    }
    console.error('ATS check error:', err);
    return res.status(500).json({ code: 'ATS_CHECK_FAILED', message: err.message || 'Failed to run ATS check.' });
  }
});

/**
 * GET /api/v1/resumes/ats/latest
 * Latest stored ATS score, grade, and full report of the latest resume.
 */
resumeRouter.get('/ats/latest', requireAuth, async (req: Request, res: Response) => {
  try {
    const latest = await AtsService.getLatestReport(req.user!.userId);
    return res.json({ latest });
  } catch (err: any) {
    console.error('ATS latest error:', err);
    return res.status(500).json({ code: 'SERVER_ERROR', message: err.message });
  }
});
