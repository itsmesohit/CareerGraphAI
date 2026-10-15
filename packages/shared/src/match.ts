import { z } from 'zod';

/**
 * Configurable weights for deterministic matching computation (Spec §10).
 * Total weights normally sum to 1.0.
 */
export interface MatchScoringWeights {
  requiredSkillsWeight: number; // default 0.35
  preferredSkillsWeight: number; // default 0.15
  seniorityWeight: number; // default 0.15
  titleWeight: number; // default 0.15
  locationWeight: number; // default 0.10
  compensationWeight: number; // default 0.10
}

export const DEFAULT_MATCH_WEIGHTS: MatchScoringWeights = {
  requiredSkillsWeight: 0.35,
  preferredSkillsWeight: 0.15,
  seniorityWeight: 0.15,
  titleWeight: 0.15,
  locationWeight: 0.10,
  compensationWeight: 0.10,
};

export const MatchScoringWeightsSchema = z.object({
  requiredSkillsWeight: z.number().min(0).max(1).default(0.35),
  preferredSkillsWeight: z.number().min(0).max(1).default(0.15),
  seniorityWeight: z.number().min(0).max(1).default(0.15),
  titleWeight: z.number().min(0).max(1).default(0.15),
  locationWeight: z.number().min(0).max(1).default(0.10),
  compensationWeight: z.number().min(0).max(1).default(0.10),
});

/**
 * Normalized 0-100 scores across individual matching dimensions.
 */
export interface MatchBreakdown {
  requiredSkillsScore: number;
  preferredSkillsScore: number;
  seniorityScore: number;
  titleScore: number;
  locationScore: number;
  compensationScore: number;
}

export interface EvidenceDemonstration {
  type: 'PROJECT' | 'EXPERIENCE' | 'EDUCATION' | 'ANSWER';
  id: string;
  title: string;
  metrics?: string[];
}

export interface MatchedSkillEvidence {
  skill: string;
  isRequired: boolean;
  weight: number;
  candidateProficiency?: string;
  yearsExperience?: number;
  isVerified: boolean;
  demonstrations: EvidenceDemonstration[];
}

export interface MissingRequirement {
  description: string;
  skill?: string;
  isHardConstraint: boolean;
  weight: number;
  category?: string;
}

export interface SupportingExperience {
  id: string;
  title: string;
  company: string;
  matchedSkills: string[];
}

export interface SupportingProject {
  id: string;
  name: string;
  matchedSkills: string[];
}

export type MatchRecommendation =
  | 'STRONG_MATCH' // >= 80%
  | 'GOOD_MATCH' // 65% - 79%
  | 'MODERATE_MATCH' // 50% - 64%
  | 'LOW_FIT' // < 50%
  | 'DISQUALIFIED'; // Eliminated by hard constraint

/**
 * Complete explainable match evaluation output (Spec §10).
 */
export interface MatchScoreResult {
  jobId: string;
  candidateId: string;
  overallScore: number; // 0 - 100
  isEliminated: boolean;
  disqualifiers: string[];
  recommendation: MatchRecommendation;
  breakdown: MatchBreakdown;
  matchedSkills: MatchedSkillEvidence[];
  missingRequirements: MissingRequirement[];
  supportingExperiences: SupportingExperience[];
  supportingProjects: SupportingProject[];
  conciseExplanation: string;
  recommendedAction: string;
  calculatedAt: string;
}

export const MatchExplainQuerySchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
});

export const TopMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  excludeEliminated: z.coerce.boolean().default(false),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
});
