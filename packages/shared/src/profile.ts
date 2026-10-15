import { z } from 'zod';
import {
  FactSourceEnum,
  VerificationStatusEnum,
  AutomationModeEnum,
  QuestionCategoryEnum,
  QuestionSensitivityEnum,
  AnswerScopeEnum,
} from './enums.js';

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------
export const ExperienceInputSchema = z.object({
  id: z.string().uuid().optional(),
  company: z.string().min(1, 'Company name is required'),
  title: z.string().min(1, 'Title is required'),
  location: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isCurrent: z.boolean().default(false),
  description: z.string().optional().nullable(),
  metrics: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  source: FactSourceEnum.optional().default('USER_INPUT'),
  verificationStatus: VerificationStatusEnum.optional().default('USER_VERIFIED'),
});
export type ExperienceInput = z.infer<typeof ExperienceInputSchema>;

export const ExperienceSchema = ExperienceInputSchema.extend({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type ExperienceDTO = z.infer<typeof ExperienceSchema>;

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------
export const EducationInputSchema = z.object({
  id: z.string().uuid().optional(),
  institution: z.string().min(1, 'Institution is required'),
  degree: z.string().min(1, 'Degree is required'),
  field: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  gradeOrCgpa: z.string().optional().nullable(),
  source: FactSourceEnum.optional().default('USER_INPUT'),
  verificationStatus: VerificationStatusEnum.optional().default('USER_VERIFIED'),
});
export type EducationInput = z.infer<typeof EducationInputSchema>;

export const EducationSchema = EducationInputSchema.extend({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type EducationDTO = z.infer<typeof EducationSchema>;

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------
export const SkillInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Skill name is required'),
  category: z.string().optional().nullable(),
  proficiency: z.string().optional().nullable(),
  yearsExperience: z.number().optional().nullable(),
  source: FactSourceEnum.optional().default('USER_INPUT'),
  verificationStatus: VerificationStatusEnum.optional().default('USER_VERIFIED'),
});
export type SkillInput = z.infer<typeof SkillInputSchema>;

export const SkillSchema = SkillInputSchema.extend({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type SkillDTO = z.infer<typeof SkillSchema>;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------
export const ProjectInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Project name is required'),
  role: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  techStack: z.array(z.string()).default([]),
  url: z.string().url().optional().nullable().or(z.literal('')),
  source: FactSourceEnum.optional().default('USER_INPUT'),
  verificationStatus: VerificationStatusEnum.optional().default('USER_VERIFIED'),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const ProjectSchema = ProjectInputSchema.extend({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type ProjectDTO = z.infer<typeof ProjectSchema>;

// ---------------------------------------------------------------------------
// Certification
// ---------------------------------------------------------------------------
export const CertificationInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Certification name is required'),
  issuer: z.string().min(1, 'Issuer is required'),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  credentialId: z.string().optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal('')),
  source: FactSourceEnum.optional().default('USER_INPUT'),
  verificationStatus: VerificationStatusEnum.optional().default('USER_VERIFIED'),
});
export type CertificationInput = z.infer<typeof CertificationInputSchema>;

export const CertificationSchema = CertificationInputSchema.extend({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type CertificationDTO = z.infer<typeof CertificationSchema>;

// ---------------------------------------------------------------------------
// Candidate Preferences
// ---------------------------------------------------------------------------
export const PreferencesInputSchema = z.object({
  targetTitles: z.array(z.string()).default([]),
  seniorityLevels: z.array(z.string()).default([]),
  targetLocations: z.array(z.string()).default([]),
  remotePreference: z.string().default('REMOTE_FIRST'),
  minSalary: z.number().int().nonnegative().optional().nullable(),
  expectedSalary: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().default('USD'),
  noticePeriodDays: z.number().int().nonnegative().default(30),
  blockedCompanies: z.array(z.string()).default([]),
  automationMode: AutomationModeEnum.default('STRICT_APPROVAL'),
  workAuthCountries: z.array(z.string()).default([]),
  requiresSponsorship: z.boolean().default(false),
});
export type PreferencesInput = z.infer<typeof PreferencesInputSchema>;

export const PreferencesSchema = PreferencesInputSchema.extend({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  updatedAt: z.string().or(z.date()),
});
export type PreferencesDTO = z.infer<typeof PreferencesSchema>;

// ---------------------------------------------------------------------------
// Fact Verification Action Schema
// ---------------------------------------------------------------------------
export const FactVerificationInputSchema = z.object({
  status: VerificationStatusEnum,
});
export type FactVerificationInput = z.infer<typeof FactVerificationInputSchema>;

// ---------------------------------------------------------------------------
// Candidate Profile
// ---------------------------------------------------------------------------
export const ProfileUpdateInputSchema = z.object({
  fullName: z.string().min(1).optional().nullable(),
  headline: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  locationCity: z.string().optional().nullable(),
  locationState: z.string().optional().nullable(),
  locationCountry: z.string().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable().or(z.literal('')),
  githubUrl: z.string().url().optional().nullable().or(z.literal('')),
  portfolioUrl: z.string().url().optional().nullable().or(z.literal('')),
});
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInputSchema>;

export const CandidateProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string().nullable(),
  headline: z.string().nullable(),
  phone: z.string().nullable(),
  locationCity: z.string().nullable(),
  locationState: z.string().nullable(),
  locationCountry: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  portfolioUrl: z.string().nullable(),
  rawResumeText: z.string().nullable(),
  resumeFileName: z.string().nullable(),
  resumeAtsScore: z.number().int().min(0).max(100).nullable(),
  resumeAtsGrade: z.string().nullable(),
  resumeAtsCheckedAt: z.string().or(z.date()).nullable(),
  coverLetterText: z.string().nullable(),
  profilePictureUrl: z.string().nullable(),
  videoIntroUrl: z.string().nullable(),
  completenessScore: z.number().int().min(0).max(100),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  experiences: z.array(ExperienceSchema).default([]),
  educations: z.array(EducationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  preferences: PreferencesSchema.nullable().optional(),
});
export type CandidateProfileDTO = z.infer<typeof CandidateProfileSchema>;

// ---------------------------------------------------------------------------
// Resume ATS Score & Improvement Suggestions (Phase 16)
// ---------------------------------------------------------------------------
export const AtsCategoryKeyEnum = z.enum([
  'CONTACT',
  'SECTIONS',
  'ACTION_VERBS',
  'QUANTIFICATION',
  'KEYWORDS',
  'READABILITY',
  'PROFILE_DEPTH',
]);
export type AtsCategoryKey = z.infer<typeof AtsCategoryKeyEnum>;

export const AtsBreakdownItemSchema = z.object({
  key: AtsCategoryKeyEnum,
  label: z.string(),
  score: z.number().min(0),
  maxScore: z.number().min(1),
  detail: z.string(),
});
export type AtsBreakdownItem = z.infer<typeof AtsBreakdownItemSchema>;

export const AtsSuggestionSeverityEnum = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type AtsSuggestionSeverity = z.infer<typeof AtsSuggestionSeverityEnum>;

export const AtsSuggestionSchema = z.object({
  title: z.string().min(3).max(120),
  detail: z.string().min(10).max(1200),
  severity: AtsSuggestionSeverityEnum,
});
export type AtsSuggestion = z.infer<typeof AtsSuggestionSchema>;

export const ResumeAtsReportSchema = z.object({
  score: z.number().int().min(0).max(100),
  grade: z.string().min(1).max(3),
  checkedAt: z.string(),
  mode: z.enum(['LLM', 'DETERMINISTIC_FALLBACK']),
  targetJobId: z.string().uuid().nullable().optional(),
  targetJobTitle: z.string().nullable().optional(),
  breakdown: z.array(AtsBreakdownItemSchema),
  keywordMatches: z.object({
    matched: z.array(z.string()),
    missing: z.array(z.string()),
  }),
  suggestions: z.array(AtsSuggestionSchema).min(1).max(12),
});
export type ResumeAtsReportDto = z.infer<typeof ResumeAtsReportSchema>;

export const AtsCheckRequestSchema = z.object({
  targetJobId: z.string().uuid().optional(),
});
export type AtsCheckRequest = z.infer<typeof AtsCheckRequestSchema>;

// ---------------------------------------------------------------------------
// Profile Assets — Cover Letter, Video Intro, Profile Picture (Phase 16)
// ---------------------------------------------------------------------------
export const ProfileAssetsInputSchema = z.object({
  coverLetterText: z.string().max(20000).optional().nullable(),
  videoIntroUrl: z
    .string()
    .url('Video intro must be a valid URL (e.g. Loom, YouTube, Drive)')
    .max(500)
    .optional()
    .nullable()
    .or(z.literal('')),
  profilePictureUrl: z
    .string()
    .max(2_600_000, 'Profile picture must be under 2MB')
    .refine(
      (v) => !v || v.startsWith('http') || v.startsWith('data:image/'),
      'Profile picture must be an image URL or base64 data URL'
    )
    .optional()
    .nullable()
    .or(z.literal('')),
});
export type ProfileAssetsInput = z.infer<typeof ProfileAssetsInputSchema>;

// ---------------------------------------------------------------------------
// Onboarding State
// ---------------------------------------------------------------------------
export const OnboardingStateUpdateSchema = z.object({
  currentStep: z.number().int().min(1).max(5),
  isCompleted: z.boolean().optional(),
  completedSteps: z.array(z.number().int()).optional(),
});
export type OnboardingStateUpdate = z.infer<typeof OnboardingStateUpdateSchema>;

export const OnboardingStateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  currentStep: z.number().int().min(1).max(5),
  isCompleted: z.boolean(),
  completedSteps: z.array(z.number().int()),
  updatedAt: z.string().or(z.date()),
});
export type OnboardingStateDTO = z.infer<typeof OnboardingStateSchema>;

// ---------------------------------------------------------------------------
// Canonical Question & Answer
// ---------------------------------------------------------------------------
export const CanonicalQuestionSchema = z.object({
  key: z.string(),
  category: QuestionCategoryEnum,
  questionText: z.string(),
  helpText: z.string().nullable().optional(),
  answerType: z.string(),
  options: z.any().optional(),
  sensitivity: QuestionSensitivityEnum,
  isCoreOnboarding: z.boolean(),
});
export type CanonicalQuestionDTO = z.infer<typeof CanonicalQuestionSchema>;

export const CandidateAnswerInputSchema = z.object({
  questionKey: z.string(),
  value: z.string().min(1, 'Answer value is required'),
  scope: AnswerScopeEnum.optional().default('GLOBAL'),
  scopeTarget: z.string().optional().nullable(),
  verificationStatus: VerificationStatusEnum.optional().default('USER_VERIFIED'),
});
export type CandidateAnswerInput = z.input<typeof CandidateAnswerInputSchema>;

export const CandidateAnswerSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  questionKey: z.string(),
  value: z.string(),
  scope: AnswerScopeEnum,
  scopeTarget: z.string().nullable(),
  verificationStatus: VerificationStatusEnum,
  usageCount: z.number().int(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  canonicalQuestion: CanonicalQuestionSchema.optional(),
});
export type CandidateAnswerDTO = z.infer<typeof CandidateAnswerSchema>;

// ---------------------------------------------------------------------------
// Profile Completeness & Suggestions
// ---------------------------------------------------------------------------
export const ProfileCompletenessSchema = z.object({
  score: z.number().int().min(0).max(100),
  breakdown: z.object({
    basics: z.number().int(),
    experience: z.number().int(),
    education: z.number().int(),
    skills: z.number().int(),
    preferences: z.number().int(),
    verification: z.number().int(),
  }),
  unverifiedFactsCount: z.number().int(),
  missingFields: z.array(z.string()),
  suggestions: z.array(z.string()),
});
export type ProfileCompletenessDTO = z.infer<typeof ProfileCompletenessSchema>;

// ---------------------------------------------------------------------------
// Resume Extraction Result (from parser)
// ---------------------------------------------------------------------------
export const ExtractedFactSchema = z.object({
  text: z.string(),
  category: z.string(),
  confidence: z.number(),
  sourceSnippet: z.string().optional(),
});

export const ResumeExtractionResultSchema = z.object({
  rawText: z.string(),
  fileName: z.string(),
  extractedProfile: z.object({
    fullName: z.string().optional(),
    headline: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    locationCity: z.string().optional(),
    locationState: z.string().optional(),
    locationCountry: z.string().optional(),
    linkedinUrl: z.string().optional(),
    githubUrl: z.string().optional(),
    portfolioUrl: z.string().optional(),
  }),
  experiences: z.array(ExperienceInputSchema.omit({ source: true, verificationStatus: true })),
  educations: z.array(EducationInputSchema.omit({ source: true, verificationStatus: true })),
  skills: z.array(SkillInputSchema.omit({ source: true, verificationStatus: true })),
  projects: z.array(ProjectInputSchema.omit({ source: true, verificationStatus: true })),
  certifications: z.array(CertificationInputSchema.omit({ source: true, verificationStatus: true })),
});
export type ResumeExtractionResult = z.infer<typeof ResumeExtractionResultSchema>;
