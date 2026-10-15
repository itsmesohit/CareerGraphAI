import { z } from 'zod';

/**
 * Phase 13 — AI Layer contracts (NVIDIA NIM / OpenAI-compatible LLM).
 * The AI Copilot is grounded strictly on the candidate's verified career graph
 * facts and must never fabricate qualifications (Spec §12 zero-hallucination).
 */

/** Roles permitted in copilot conversation history */
export const CopilotMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export type CopilotMessage = z.infer<typeof CopilotMessageSchema>;

/** POST /api/v1/ai/copilot request body */
export const CopilotChatRequestSchema = z.object({
  messages: z.array(CopilotMessageSchema).min(1).max(24),
});
export type CopilotChatRequest = z.infer<typeof CopilotChatRequestSchema>;

/** POST /api/v1/ai/copilot response */
export const CopilotChatResponseDtoSchema = z.object({
  reply: z.string(),
  model: z.string(),
  provider: z.string(),
  mode: z.enum(['LLM', 'DETERMINISTIC_FALLBACK']),
  grounded: z.boolean(),
});
export type CopilotChatResponseDto = z.infer<typeof CopilotChatResponseDtoSchema>;

/** GET /api/v1/ai/status response */
export const AIStatusDtoSchema = z.object({
  enabled: z.boolean(),
  provider: z.string(),
  model: z.string(),
  streaming: z.boolean(),
  fallbackReason: z.string().optional(),
});
export type AIStatusDto = z.infer<typeof AIStatusDtoSchema>;