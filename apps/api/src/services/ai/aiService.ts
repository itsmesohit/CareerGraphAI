import { prisma } from '@careergraph/db';
import { z } from 'zod';
import type { CopilotChatRequest, CopilotChatResponseDto, AIStatusDto } from '@careergraph/shared';
import { env } from '../../config/env.js';
import {
  ResumeTailoringAgent,
  CoverLetterAgent,
  QuestionAnsweringAgent,
  type ResumeTailoringInput,
  type TailoredResumeResult,
  type CoverLetterInput,
  type QuestionAnsweringInput,
  type QuestionAnsweringResult,
} from '../applications/specialistAgents.js';
import { promptInjectionService } from '../security/promptInjectionService.js';
import {
  isLLMEnabled,
  llmFallbackReason,
  chatCompletion,
  streamChatCompletion,
  stripJsonFences,
  type LLMChatMessage,
} from './llmClient.js';
import {
  RESUME_TAILORING_SYSTEM,
  COVER_LETTER_SYSTEM,
  QUESTION_ANSWERING_SYSTEM,
  COPILOT_SYSTEM,
} from './prompts.js';

/**
 * Phase 13 — AI Service.
 *
 * LLM-enhanced versions of the three specialist agents (Spec §12) plus the
 * interactive career copilot. Every method is strictly grounded: candidate
 * facts are injected into <candidate_facts>, external text is wrapped by the
 * Phase 11 prompt-injection sanitizer, and outputs are validated — any LLM
 * failure, timeout, or malformed output transparently falls back to the
 * deterministic agents, so the platform always works even fully offline.
 */

const TailoredResumeLLMSchema = z.object({
  headline: z.string().min(4).max(140),
  summary: z.string().min(20).max(1400),
  tailoredBullets: z.array(z.string().min(8).max(600)).min(3).max(8),
  highlightedSkills: z.array(z.string().min(1).max(60)).min(1).max(15),
});

const QuestionAnsweringLLMSchema = z.object({
  answers: z
    .array(
      z.object({
        questionKey: z.string().min(1),
        answer: z.string().min(2).max(2000),
        confidence: z.number().min(0).max(1),
        source: z.string().min(2).max(60),
      })
    )
    .max(60),
  missing: z
    .array(
      z.object({
        questionKey: z.string().min(1),
        questionText: z.string().min(4).max(500),
        category: z.string().min(2).max(60),
        reason: z.string().min(4).max(800),
        suggestedAnswer: z.string().max(2000).optional(),
      })
    )
    .max(60),
});

/** Builds the grounding block the model is allowed to reason over. */
function candidateFactsBlock(facts: string): string {
  return `<candidate_facts>\n${facts.trim()}\n</candidate_facts>`;
}

/** Wraps external/untrusted text (job data) with the injection sanitizer. */
function untrustedBlock(content: string, origin: string): string {
  return promptInjectionService.sanitizeExternalContent(content, origin).sanitized;
}

export class AIService {
  /**
   * 1. Resume Tailoring (LLM with deterministic fallback).
   */
  static async tailorResume(input: ResumeTailoringInput): Promise<TailoredResumeResult> {
    if (!isLLMEnabled()) {
      return ResumeTailoringAgent.tailor(input);
    }

    try {
      const facts = [
        `Target role: ${input.jobTitle} at ${input.company}`,
        `Required skills: ${input.requiredSkills.join(', ')}`,
        'Verified work experiences:',
        ...input.candidateExperiences.map(
          (e) => `- ${e.title} at ${e.company} | bullets: ${e.bullets.join(' | ')} | skills: ${e.skills.join(', ')}`
        ),
        'Verified projects:',
        ...input.candidateProjects.map(
          (p) => `- ${p.title}: ${p.description ?? ''} ${p.metrics ? `Impact: ${p.metrics}` : ''} | skills: ${p.skills.join(', ')}`
        ),
      ].join('\n');

      const raw = await chatCompletion({
        messages: [
          { role: 'system', content: RESUME_TAILORING_SYSTEM },
          {
            role: 'user',
            content: `${candidateFactsBlock(facts)}\n\n${untrustedBlock(
              `Target job: ${input.jobTitle} at ${input.company}. Required skills: ${input.requiredSkills.join(', ')}.`,
              'job_posting'
            )}\n\nTailor the resume package now.`,
          },
        ],
        maxTokens: 1400,
      });

      const parsed = TailoredResumeLLMSchema.parse(JSON.parse(stripJsonFences(raw)));

      // Grounding enforcement: bullets must reference real candidate tokens
      const groundingTokens = [
        ...input.requiredSkills,
        ...input.candidateExperiences.flatMap((e) => [e.company, e.title]),
        ...input.candidateProjects.map((p) => p.title),
      ]
        .filter(Boolean)
        .map((t) => t.toLowerCase());

      const groundedBullets = parsed.tailoredBullets.filter((b) =>
        groundingTokens.some((t) => b.toLowerCase().includes(t))
      );

      if (groundedBullets.length < Math.ceil(parsed.tailoredBullets.length * 0.6)) {
        throw new Error('LLM output failed grounding validation');
      }

      // Highlighted skills must be real job requirements
      const reqLower = new Set(input.requiredSkills.map((s) => s.toLowerCase()));
      const highlightedSkills = parsed.highlightedSkills.filter((s) => reqLower.has(s.toLowerCase()));
      if (highlightedSkills.length === 0) highlightedSkills.push(...input.requiredSkills.slice(0, 8));

      return {
        headline: parsed.headline,
        summary: parsed.summary,
        tailoredBullets: groundedBullets.length >= 3 ? groundedBullets : parsed.tailoredBullets,
        highlightedSkills,
      };
    } catch (err: any) {
      console.warn('[AIService] Resume tailoring LLM fallback:', err.message);
      return ResumeTailoringAgent.tailor(input);
    }
  }

  /**
   * 2. Cover Letter (LLM with deterministic fallback).
   */
  static async draftCoverLetter(input: CoverLetterInput): Promise<string> {
    if (!isLLMEnabled()) {
      return CoverLetterAgent.draft(input);
    }

    try {
      const facts = [
        `Candidate name: ${input.candidateName}`,
        `Target role: ${input.jobTitle} at ${input.company}${input.location ? ` (${input.location})` : ''}`,
        `Verified matched skills: ${input.matchedSkills.join(', ')}`,
        input.topExperience ? `Most relevant experience: ${input.topExperience.title} at ${input.topExperience.company}` : '',
        input.topProject
          ? `Top verified project: ${input.topProject.title}${input.topProject.description ? ` — ${input.topProject.description}` : ''}${
              input.topProject.metrics ? ` (Impact: ${input.topProject.metrics})` : ''
            }`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const letter = await chatCompletion({
        messages: [
          { role: 'system', content: COVER_LETTER_SYSTEM },
          { role: 'user', content: `${candidateFactsBlock(facts)}\n\nDraft the cover letter now.` },
        ],
        maxTokens: 1200,
      });

      // Grounding guardrail: letter must be signed by the real candidate name
      if (!letter.toLowerCase().includes(input.candidateName.toLowerCase().split(' ')[0])) {
        throw new Error('LLM cover letter failed signature validation');
      }
      if (letter.length < 400 || letter.length > 6000) {
        throw new Error('LLM cover letter length out of bounds');
      }

      return letter.trim();
    } catch (err: any) {
      console.warn('[AIService] Cover letter LLM fallback:', err.message);
      return CoverLetterAgent.draft(input);
    }
  }

  /**
   * 3. Screening Question Answering (LLM with deterministic fallback).
   */
  static async evaluateQuestions(input: QuestionAnsweringInput): Promise<QuestionAnsweringResult> {
    // Deterministic baseline always computed first: it defines the question
    // universe, preference-derived answers, and missing-info contract.
    const baseline = QuestionAnsweringAgent.evaluateQuestions(input);

    if (!isLLMEnabled()) {
      return baseline;
    }

    try {
      const answerableKeys = new Set([
        ...input.candidateAnswers.map((a) => a.questionKey),
        ...Object.keys(baseline.preparedAnswers),
      ]);

      const facts = [
        `Target company: ${input.company} | Role: ${input.jobTitle}`,
        `Candidate work preferences: notice period ${input.candidatePreferences?.noticePeriodDays ?? 'unknown'} days, expected salary ${
          input.candidatePreferences?.expectedSalary ?? 'unknown'
        }, requires sponsorship: ${input.candidatePreferences?.requiresSponsorship ?? 'unknown'}, remote preference: ${
          input.candidatePreferences?.remotePreference ?? 'unknown'
        }`,
        'Verified answers from the universal answer bank:',
        ...input.candidateAnswers.map(
          (a) => `- [${a.questionKey}] ${a.questionText} => ${a.answerText}${a.category ? ` (category: ${a.category})` : ''}`
        ),
        `Job requirements: ${input.requirements.map((r) => `${r.description}${r.isHardConstraint ? ' (hard constraint)' : ''}`).join('; ')}`,
        `Skills the candidate has NO verified evidence for: ${input.missingSkills.join(', ') || 'none'}`,
      ].join('\n');

      const raw = await chatCompletion({
        messages: [
          { role: 'system', content: QUESTION_ANSWERING_SYSTEM },
          { role: 'user', content: `${candidateFactsBlock(facts)}\n\nQuestion keys you may answer: ${[...answerableKeys].join(', ')}. Prepare the answers now.` },
        ],
        maxTokens: 1800,
      });

      const parsed = QuestionAnsweringLLMSchema.parse(JSON.parse(stripJsonFences(raw)));

      // Merge strategy: LLM may only answer keys the deterministic layer knows
      const preparedAnswers = { ...baseline.preparedAnswers };
      const missingByKey = new Map(baseline.missingItems.map((m) => [m.questionKey, m]));

      for (const answer of parsed.answers) {
        if (!answerableKeys.has(answer.questionKey)) continue; // unknown question → reject
        preparedAnswers[answer.questionKey] = {
          questionKey: answer.questionKey,
          question: baseline.preparedAnswers[answer.questionKey]?.question ?? answer.questionKey,
          answer: answer.answer,
          confidence: answer.confidence,
          source: answer.source as any,
        };
        missingByKey.delete(answer.questionKey);
      }

      for (const missing of parsed.missing) {
        if (preparedAnswers[missing.questionKey]) continue; // already answered
        missingByKey.set(missing.questionKey, {
          questionKey: missing.questionKey,
          questionText: missing.questionText,
          category: missing.category,
          reason: missing.reason,
          suggestedAnswer: missing.suggestedAnswer,
        });
      }

      return {
        preparedAnswers,
        missingItems: [...missingByKey.values()],
      };
    } catch (err: any) {
      console.warn('[AIService] Question answering LLM fallback:', err.message);
      return baseline;
    }
  }

  /**
   * 4. Interactive Career Copilot.
   */
  private static async buildCopilotContext(userId: string): Promise<string> {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experiences: { orderBy: { createdAt: 'desc' }, take: 5 },
        skills: { take: 40 },
        projects: { orderBy: { createdAt: 'desc' }, take: 5 },
        preferences: true,
      },
    });

    const [applicationsCount, openJobsCount] = await Promise.all([
      prisma.application.count({ where: { userId } }),
      prisma.jobPosting.count({ where: { status: 'OPEN' } }),
    ]);

    if (!profile) {
      return candidateFactsBlock(
        [
          'The candidate has not completed profile onboarding yet.',
          `Applications in pipeline: ${applicationsCount}.`,
          `Open jobs discovered on the platform: ${openJobsCount}.`,
          'Encourage completing the onboarding wizard to unlock matching and autonomous apply.',
        ].join(' ')
      );
    }

    const facts = [
      `Name: ${profile.fullName}`,
      `Current/target headline: ${profile.headline ?? 'not set'}`,
      `Target titles: ${profile.preferences?.targetTitles.join(', ') ?? 'not set'}`,
      `Verified skills (${profile.skills.length}): ${profile.skills.map((s: any) => s.name).slice(0, 30).join(', ')}`,
      ...profile.experiences.map(
        (e: any) => `Experience: ${e.title} at ${e.company} (${e.startDate ?? ''} - ${e.endDate ?? (e.isCurrent ? 'present' : '')})${e.description ? ` — ${e.description}` : ''}${e.metrics?.length ? ` | metrics: ${e.metrics.join(' | ')}` : ''}`
      ),
      ...profile.projects.map(
        (p: any) => `Project: ${p.name || p.title} — ${p.description ?? ''} ${p.techStack?.length ? `Stack: ${p.techStack.join(', ')}` : ''}`
      ),
      `Work preferences: notice ${profile.preferences?.noticePeriodDays ?? 'unknown'} days; remote: ${profile.preferences?.remotePreference ?? 'unknown'}; sponsorship needed: ${profile.preferences?.requiresSponsorship ?? 'unknown'}`,
      `Profile completeness: ${profile.completenessScore ?? 0}%`,
      `Applications in pipeline: ${applicationsCount}. Open jobs on platform: ${openJobsCount}.`,
    ].join('\n');

    return candidateFactsBlock(facts);
  }

  private static deterministicCopilotReply(context: string, lastMessage: string): string {
    const nameMatch = context.match(/Name: (.+)/);
    const skillsMatch = context.match(/Verified skills \((\d+)\)/);
    return `I'm currently running in **deterministic mode** (the LLM layer is disabled or unreachable), so here's what your verified career graph shows:\n\n${
      nameMatch ? `- Candidate: ${nameMatch[1]}\n` : ''
    }- ${skillsMatch ? `${skillsMatch[1]} verified skills ` : ''}on record, all grounded in your uploaded evidence.\n- You asked: "${lastMessage.slice(0, 200)}"\n\nEnable AI_ENABLED with a valid AI_API_KEY to unlock full conversational answers, or explore your Career Graph and Discover Jobs pages for verified facts.`;
  }

  static async copilotChat(userId: string, input: CopilotChatRequest): Promise<CopilotChatResponseDto> {
    const context = await this.buildCopilotContext(userId);
    const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    if (!isLLMEnabled()) {
      return {
        reply: this.deterministicCopilotReply(context, lastUserMessage),
        model: env.AI_MODEL,
        provider: env.AI_PROVIDER,
        mode: 'DETERMINISTIC_FALLBACK',
        grounded: true,
      };
    }

    try {
      const history: LLMChatMessage[] = input.messages.slice(-12).map((m) => {
        if (m.role !== 'user') return { role: 'assistant' as const, content: m.content };
        // Neutralize prompt-injection attempts inside user text (Phase 11)
        const scan = promptInjectionService.sanitizeExternalContent(m.content, 'copilot_user_message');
        return { role: 'user' as const, content: scan.isFlagged ? scan.sanitized : m.content };
      });

      const reply = await chatCompletion({
        messages: [{ role: 'system', content: `${COPILOT_SYSTEM}\n\n${context}` }, ...history],
      });

      return {
        reply: reply || 'I could not generate a response. Please try again.',
        model: env.AI_MODEL,
        provider: env.AI_PROVIDER,
        mode: 'LLM',
        grounded: true,
      };
    } catch (err: any) {
      console.warn('[AIService] Copilot LLM fallback:', err.message);
      return {
        reply: this.deterministicCopilotReply(context, lastUserMessage),
        model: env.AI_MODEL,
        provider: env.AI_PROVIDER,
        mode: 'DETERMINISTIC_FALLBACK',
        grounded: true,
      };
    }
  }

  /**
   * Streaming variant used by the SSE route. Yields incremental deltas and a
   * final done event carrying the response mode.
   */
  static async *copilotChatStream(
    userId: string,
    input: CopilotChatRequest
  ): AsyncGenerator<{ delta?: string; mode?: 'LLM' | 'DETERMINISTIC_FALLBACK'; model?: string }> {
    const context = await this.buildCopilotContext(userId);
    const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    if (!isLLMEnabled()) {
      yield { delta: this.deterministicCopilotReply(context, lastUserMessage), mode: 'DETERMINISTIC_FALLBACK', model: env.AI_MODEL };
      return;
    }

    try {
      const history: LLMChatMessage[] = input.messages.slice(-12).map((m) => {
        if (m.role !== 'user') return { role: 'assistant' as const, content: m.content };
        const scan = promptInjectionService.sanitizeExternalContent(m.content, 'copilot_user_message');
        return { role: 'user' as const, content: scan.isFlagged ? scan.sanitized : m.content };
      });

      for await (const delta of streamChatCompletion({
        messages: [{ role: 'system', content: `${COPILOT_SYSTEM}\n\n${context}` }, ...history],
      })) {
        yield { delta };
      }
      yield { mode: 'LLM', model: env.AI_MODEL };
    } catch (err: any) {
      console.warn('[AIService] Copilot stream LLM fallback:', err.message);
      yield { delta: this.deterministicCopilotReply(context, lastUserMessage), mode: 'DETERMINISTIC_FALLBACK', model: env.AI_MODEL };
    }
  }

  /**
   * 5. Status (for UI widgets and the extension popup).
   */
  static getStatus(): AIStatusDto {
    return {
      enabled: isLLMEnabled(),
      provider: env.AI_PROVIDER,
      model: env.AI_MODEL,
      streaming: true,
      fallbackReason: llmFallbackReason(),
    };
  }
}
