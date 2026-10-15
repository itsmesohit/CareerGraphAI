import OpenAI from 'openai';
import { env } from '../../config/env.js';

/**
 * Phase 13 — LLM client for OpenAI-compatible endpoints.
 * Default provider: NVIDIA NIM (https://integrate.api.nvidia.com/v1) hosting
 * the z-ai/glm-5.3 model. Any OpenAI-compatible gateway works by changing
 * AI_BASE_URL / AI_MODEL / AI_API_KEY in the environment.
 */

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

let client: OpenAI | null = null;

/**
 * LLM calls are enabled only when explicitly configured AND never inside the
 * automated test suite (tests must stay deterministic and offline).
 */
export function isLLMEnabled(): boolean {
  if (env.NODE_ENV === 'test') return false;
  return env.AI_ENABLED && env.AI_API_KEY.trim().length > 0 && env.AI_BASE_URL.trim().length > 0;
}

/** Human-readable explanation of why the deterministic fallback is active. */
export function llmFallbackReason(): string | undefined {
  if (env.NODE_ENV === 'test') return 'LLM disabled in test environment (deterministic fallback)';
  if (!env.AI_ENABLED) return 'AI_ENABLED is set to false (deterministic fallback)';
  if (!env.AI_API_KEY.trim()) return 'AI_API_KEY not configured (deterministic fallback)';
  return undefined;
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
      // NIM serverless models can take minutes on a cold start before the
      // first token arrives; generous timeout with one retry.
      timeout: 120_000,
      maxRetries: 1,
    });
  }
  return client;
}

export interface ChatCompletionOptions {
  messages: LLMChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

/** Single-shot completion returning the assistant message text.
 *
 * Implemented over the streaming API: several NVIDIA NIM-hosted models
 * (including z-ai/glm-5.3) only reliably answer in streaming mode, so we
 * consume the stream and concatenate the deltas.
 */
export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const stream = await getClient().chat.completions.create({
    model: env.AI_MODEL,
    messages: options.messages,
    temperature: options.temperature ?? env.AI_TEMPERATURE,
    top_p: 1,
    max_tokens: options.maxTokens ?? env.AI_MAX_TOKENS,
    stream: true,
  });

  let result = '';
  for await (const chunk of stream) {
    result += chunk.choices[0]?.delta?.content ?? '';
  }
  return result.trim();
}

/** Streaming completion yielding incremental delta strings as they arrive. */
export async function* streamChatCompletion(options: ChatCompletionOptions): AsyncGenerator<string> {
  const stream = await getClient().chat.completions.create({
    model: env.AI_MODEL,
    messages: options.messages,
    temperature: options.temperature ?? env.AI_TEMPERATURE,
    top_p: 1,
    max_tokens: options.maxTokens ?? env.AI_MAX_TOKENS,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/** Strips markdown code fences some models wrap around JSON payloads. */
export function stripJsonFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  return cleaned.trim();
}