import { prisma } from '@careergraph/db';
import { z } from 'zod';
import type {
  ResumeAtsReportDto,
  AtsBreakdownItem,
  AtsSuggestion,
  AtsSuggestionSeverity,
  AtsCheckRequest,
} from '@careergraph/shared';
import { isLLMEnabled, chatCompletion, stripJsonFences } from '../ai/llmClient.js';

/**
 * Phase 16 — Resume ATS Checker.
 *
 * Deterministic 7-category scoring engine over the stored resume text, with
 * LLM-enriched improvement suggestions grounded on the candidate's verified
 * profile facts and the target job profile (Spec §12 zero-hallucination:
 * suggestions reference only report findings, never invent experience).
 */

const ACTION_VERBS = [
  'led', 'built', 'designed', 'developed', 'launched', 'shipped', 'architected', 'implemented',
  'created', 'delivered', 'drove', 'owned', 'scaled', 'optimized', 'reduced', 'increased',
  'improved', 'automated', 'migrated', 'refactored', 'mentored', 'collaborated', 'integrated',
  'deployed', 'established', 'streamlined', 'accelerated', 'engineered', 'spearheaded', 'achieved',
];

const STANDARD_SECTIONS = [
  { key: 'summary', patterns: [/summary|objective|profile/i] },
  { key: 'experience', patterns: [/experience|employment|work history|professional background/i] },
  { key: 'education', patterns: [/education|academic/i] },
  { key: 'skills', patterns: [/skills|technologies|tech stack|competencies/i] },
  { key: 'projects', patterns: [/projects|portfolio|open source/i] },
];

/** Splits resume text into scoring lines (bullets or sentences). */
function splitLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
}

/** Normalizes text for token-level keyword comparison. */
function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]/g, '').trim();
}

/**
 * Parses the most significant 4-digit year out of a loose date string like
 * "2023-05", "May 2023", "2023", "Jan 2020 - Present", or "".
 */
function parseYear(value?: string | null): number {
  if (!value) return 0;
  if (/present|current|now/i.test(value)) return 9999;
  const match = value.match(/(19|20)\d{2}/);
  return match ? parseInt(match[0], 10) : 0;
}

/** Deterministic scoring for a single category. */
interface CategoryScore {
  item: AtsBreakdownItem;
  found: string[];
}

function scoreContact(text: string): CategoryScore {
  const found: string[] = [];
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) found.push('email');
  if (/(\+?\d[\d\s().-]{7,}\d)/.test(text)) found.push('phone');
  if (/linkedin\.com\/[in]/i.test(text)) found.push('linkedin');
  if (/(remote|[a-z\s]+,\s*[a-z]{2,})\b/i.test(text)) found.push('location');
  const score = found.length * 2.5; // max 10
  return {
    item: {
      key: 'CONTACT',
      label: 'Contact & Links',
      score: Math.round(score * 10) / 10,
      maxScore: 10,
      detail: `Found: ${found.length ? found.join(', ') : 'none'}. Recruiters need email, phone, LinkedIn, and location.`,
    },
    found,
  };
}

function scoreSections(text: string): CategoryScore {
  const found: string[] = [];
  for (const section of STANDARD_SECTIONS) {
    if (section.patterns.some((p) => p.test(text))) found.push(section.key);
  }
  const score = (found.length / STANDARD_SECTIONS.length) * 12;
  return {
    item: {
      key: 'SECTIONS',
      label: 'Standard Sections',
      score: Math.round(score * 10) / 10,
      maxScore: 12,
      detail: `Detected ${found.length}/${STANDARD_SECTIONS.length} standard sections (${found.join(', ') || 'none'}). ATS parsers rely on recognizable headings.`,
    },
    found,
  };
}

function scoreActionVerbs(text: string): CategoryScore {
  const lines = splitLines(text);
  const withVerbs = lines.filter((line) =>
    ACTION_VERBS.some((verb) => new RegExp(`\\b${verb}\\b`, 'i').test(line))
  );
  const ratio = lines.length > 0 ? withVerbs.length / lines.length : 0;
  const score = Math.min(1, ratio / 0.45) * 12; // 45%+ of lines with strong verbs = full marks
  return {
    item: {
      key: 'ACTION_VERBS',
      label: 'Action Verbs',
      score: Math.round(score * 10) / 10,
      maxScore: 12,
      detail: `${withVerbs.length} of ${lines.length} lines start with or contain strong action verbs. Target 45%+.`,
    },
    found: withVerbs,
  };
}

function scoreQuantification(text: string): CategoryScore {
  const lines = splitLines(text);
  const quantified = lines.filter(
    (line) => /(\d+(\.\d+)?\s*%|\$\s?\d|\b\d+(,\d+)?\s?(k|m|bn|million|billion|users|customers|hours|days|weeks|requests|qps|req\/s)\b|\bx\d+\b)/i.test(line)
  );
  const ratio = lines.length > 0 ? quantified.length / lines.length : 0;
  const score = Math.min(1, ratio / 0.35) * 14; // 35%+ quantified lines = full marks
  return {
    item: {
      key: 'QUANTIFICATION',
      label: 'Quantified Impact',
      score: Math.round(score * 10) / 10,
      maxScore: 14,
      detail: `${quantified.length} of ${lines.length} lines contain measurable impact (%, $, scale). Target 35%+.`,
    },
    found: quantified,
  };
}

function scoreKeywords(resumeText: string, targetKeywords: string[]): CategoryScore & { matched: string[]; missing: string[] } {
  const normalizedResume = normalizeToken(resumeText);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const keyword of targetKeywords) {
    const token = normalizeToken(keyword);
    if (token && normalizedResume.includes(token)) matched.push(keyword);
    else missing.push(keyword);
  }
  const ratio = targetKeywords.length > 0 ? matched.length / targetKeywords.length : 1;
  const score = ratio * 25;
  return {
    item: {
      key: 'KEYWORDS',
      label: 'Target Keywords',
      score: Math.round(score * 10) / 10,
      maxScore: 25,
      detail: `Matched ${matched.length} of ${targetKeywords.length} target skills${missing.length ? `. Missing: ${missing.slice(0, 6).join(', ')}` : ''}.`,
    },
    found: matched,
    matched,
    missing,
  };
}

function scoreReadability(text: string): CategoryScore {
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = splitLines(text);
  const avgLineWords = lines.length > 0 ? words / lines.length : words;

  let score = 0;
  if (words >= 350 && words <= 900) score += 6;
  else if (words >= 200) score += 3;
  if (avgLineWords <= 22) score += 4;
  else if (avgLineWords <= 30) score += 2;
  if (lines.length >= 12) score += 2;

  return {
    item: {
      key: 'READABILITY',
      label: 'Readability & Length',
      score: Math.min(12, score),
      maxScore: 12,
      detail: `${words} words across ${lines.length} lines (avg ${Math.round(avgLineWords)} words/line). ATS-friendly resumes are 350-900 words with concise lines.`,
    },
    found: [],
  };
}

function scoreProfileDepth(profile: any): CategoryScore {
  let score = 0;
  const notes: string[] = [];
  if (profile.experiences.length >= 2) score += 6;
  else notes.push('add a second experience entry');
  if (profile.educations.length >= 1) score += 3;
  else notes.push('add education');
  if (profile.skills.length >= 8) score += 4;
  else notes.push(`add ${8 - profile.skills.length} more skills`);
  if (profile.projects.length >= 1) score += 2;
  else notes.push('add at least one project');

  return {
    item: {
      key: 'PROFILE_DEPTH',
      label: 'Career Depth',
      score: Math.min(15, score),
      maxScore: 15,
      detail: `${profile.experiences.length} experiences, ${profile.educations.length} educations, ${profile.skills.length} skills, ${profile.projects.length} projects in your verified graph.${notes.length ? ` Next: ${notes.join('; ')}.` : ' Great depth.'}`,
    },
    found: [],
  };
}

function gradeFor(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 68) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/** Deterministic suggestions derived from weak categories and missing keywords. */
function deterministicSuggestions(
  breakdown: AtsBreakdownItem[],
  matched: string[],
  missing: string[]
): AtsSuggestion[] {
  const suggestions: AtsSuggestion[] = [];

  for (const item of breakdown) {
    const ratio = item.score / item.maxScore;
    if (ratio >= 0.7) continue;

    const map: Record<string, { title: string; detail: string; severity: AtsSuggestionSeverity }> = {
      CONTACT: {
        title: 'Complete your contact header',
        detail: 'Place an email, phone number, LinkedIn URL, and location at the very top of the resume. ATS parsers extract these first.',
        severity: 'HIGH',
      },
      SECTIONS: {
        title: 'Add missing standard section headings',
        detail: 'Use recognizable headings like "Experience", "Education", "Skills", and "Projects". Creative heading names confuse ATS parsers.',
        severity: 'MEDIUM',
      },
      ACTION_VERBS: {
        title: 'Start bullets with strong action verbs',
        detail: 'Lead with verbs like Led, Built, Designed, Shipped, Optimized, or Scaled instead of "responsible for" or "worked on".',
        severity: 'MEDIUM',
      },
      QUANTIFICATION: {
        title: 'Quantify your impact with metrics',
        detail: 'Add measurable outcomes to bullets — percentages, user counts, latency, revenue, or time saved. Example: "Reduced API latency by 42%".',
        severity: 'HIGH',
      },
      KEYWORDS: {
        title: 'Weave missing target keywords into your resume',
        detail: missing.length
          ? `Naturally integrate these target skills where you actually used them: ${missing.slice(0, 8).join(', ')}. Never add skills you cannot back up in interviews.`
          : 'Align your resume vocabulary with the target role\'s skill requirements.',
        severity: 'HIGH',
      },
      READABILITY: {
        title: 'Tighten resume length and density',
        detail: 'Keep the resume between 350-900 words with concise 1-2 line bullets. Long paragraphs get truncated by ATS parsers.',
        severity: 'LOW',
      },
      PROFILE_DEPTH: {
        title: 'Enrich your verified career graph',
        detail: 'Add missing experiences, education, skills, and projects in your CareerGraph profile — recruiters and the AI agent both rely on this depth for matching.',
        severity: 'MEDIUM',
      },
    };

    const entry = map[item.key];
    if (entry) suggestions.push(entry);
  }

  return suggestions.slice(0, 8);
}

const LlmSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        detail: z.string().min(10).max(1200),
        severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      })
    )
    .min(1)
    .max(6),
});

/** LLM-enriched suggestions grounded strictly on the deterministic report. */
async function llmSuggestions(report: Omit<ResumeAtsReportDto, 'suggestions' | 'mode'>): Promise<AtsSuggestion[] | null> {
  try {
    const raw = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are the Resume Improvement Advisor of CareerGraph AI. You receive a deterministic ATS report (category scores, keyword gaps) and the candidate's verified profile facts.
Give 3-5 concrete, prioritized suggestions to improve THIS resume.
Constraints:
- Base every suggestion only on the report findings and provided profile facts. Never invent experience, metrics, employers, or skills the candidate does not have.
- Be specific: reference the actual category scores, the missing keywords, and profile facts by name.
- severity is HIGH for issues that cause automatic ATS rejections (missing contact info, missing hard keywords), MEDIUM for scoring improvements, LOW for polish.
Return ONLY valid JSON: {"suggestions":[{"title":string,"detail":string,"severity":"HIGH"|"MEDIUM"|"LOW"}]}`,
        },
        {
          role: 'user',
          content: `<ats_report>\n${JSON.stringify(report, null, 2)}\n</ats_report>\n\nProduce the improvement suggestions now.`,
        },
      ],
      maxTokens: 1200,
      temperature: 0.3,
    });

    const parsed = LlmSuggestionsSchema.parse(JSON.parse(stripJsonFences(raw)));
    return parsed.suggestions;
  } catch (err: any) {
    console.warn('[AtsService] LLM suggestions fallback:', err.message);
    return null;
  }
}

export class AtsService {
  /**
   * Runs the full deterministic ATS check over the latest stored resume,
   * enriches suggestions via the LLM when available, persists the latest
   * score/grade/report on the CandidateProfile, and returns the report.
   */
  static async checkResume(userId: string, request?: AtsCheckRequest): Promise<ResumeAtsReportDto> {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experiences: true,
        educations: true,
        skills: true,
        projects: true,
        preferences: true,
      },
    });

    if (!profile?.rawResumeText || profile.rawResumeText.trim().length === 0) {
      throw Object.assign(new Error('No resume on file. Upload a resume first.'), { status: 400, code: 'NO_RESUME' });
    }

    const resumeText = profile.rawResumeText;

    // Target keywords: target job skills if provided, else verified profile skills
    let targetJobTitle: string | null = null;
    let targetKeywords: string[] = profile.skills.map((s: any) => s.name);

    if (request?.targetJobId) {
      const job = await prisma.jobPosting.findUnique({
        where: { id: request.targetJobId },
      });
      if (job) {
        targetJobTitle = `${job.title} at ${job.company}`;
        if (job.skills?.length) targetKeywords = job.skills;
      }
    } else if (profile.preferences?.targetTitles?.length) {
      targetJobTitle = profile.preferences.targetTitles.join(', ');
    }

    const contact = scoreContact(resumeText);
    const sections = scoreSections(resumeText);
    const verbs = scoreActionVerbs(resumeText);
    const quant = scoreQuantification(resumeText);
    const keywords = scoreKeywords(resumeText, targetKeywords);
    const readability = scoreReadability(resumeText);
    const depth = scoreProfileDepth(profile);

    const breakdown = [contact.item, sections.item, verbs.item, quant.item, keywords.item, readability.item, depth.item];
    const score = Math.round(breakdown.reduce((sum, item) => sum + item.score, 0));
    const checkedAt = new Date().toISOString();

    const baseReport = {
      score,
      grade: gradeFor(score),
      checkedAt,
      targetJobId: request?.targetJobId ?? null,
      targetJobTitle,
      breakdown,
      keywordMatches: { matched: keywords.matched, missing: keywords.missing },
    };

    const fallback = deterministicSuggestions(breakdown, keywords.matched, keywords.missing);
    const llm = isLLMEnabled() ? await llmSuggestions(baseReport) : null;

    const suggestions = llm ? [...llm, ...fallback].slice(0, 12) : fallback;
    const report: ResumeAtsReportDto = {
      ...baseReport,
      mode: llm ? 'LLM' : 'DETERMINISTIC_FALLBACK',
      suggestions:
        suggestions.length > 0
          ? suggestions
          : [
              {
                title: 'Keep strengthening your resume',
                detail: 'Your resume already covers the fundamentals. Keep quantifying impact and aligning keywords with target roles.',
                severity: 'LOW',
              },
            ],
    };

    // Persist the latest score of the latest resume
    await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: {
        resumeAtsScore: report.score,
        resumeAtsGrade: report.grade,
        resumeAtsCheckedAt: new Date(),
        resumeAtsReport: report as any,
      },
    });

    return report;
  }

  /** Returns the latest stored ATS score & report for the candidate. */
  static async getLatestReport(userId: string) {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: {
        resumeAtsScore: true,
        resumeAtsGrade: true,
        resumeAtsCheckedAt: true,
        resumeAtsReport: true,
        resumeFileName: true,
      },
    });

    if (!profile?.resumeAtsReport) return null;

    return {
      score: profile.resumeAtsScore,
      grade: profile.resumeAtsGrade,
      checkedAt: profile.resumeAtsCheckedAt?.toISOString() ?? null,
      resumeFileName: profile.resumeFileName,
      report: profile.resumeAtsReport,
    };
  }
}
