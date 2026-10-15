import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Walk upwards from current file location to find root .env
let curDir = path.resolve(__dirname, '..');
while (curDir !== '/' && !fs.existsSync(path.join(curDir, '.env'))) {
  curDir = path.dirname(curDir);
}
if (fs.existsSync(path.join(curDir, '.env'))) {
  dotenv.config({ path: path.join(curDir, '.env') });
} else {
  dotenv.config();
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_BASE_URL: z.string().default('http://localhost:3001/api/v1'),
  WEB_URL: z.string().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_TEST_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT & Security
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16).default('careergraph-cookie-secret-key-32'),

  // Email
  EMAIL_PROVIDER: z.enum(['mailpit', 'resend', 'smtp']).default('mailpit'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('CareerGraph AI <notifications@codingspark.in>'),

  // Resend
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('CareerGraph AI <verify@codingspark.in>'),

  // LLM Providers (Optional for resume parsing & agents)
  OPENAI_API_KEY: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),

  // AI Layer — OpenAI-compatible endpoint (default: NVIDIA NIM hosting z-ai/glm-5.3)
  AI_PROVIDER: z.string().default('nvidia'),
  AI_BASE_URL: z.string().default('https://integrate.api.nvidia.com/v1'),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('z-ai/glm-5.3'),
  AI_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.4),
  AI_MAX_TOKENS: z.coerce.number().int().min(256).max(32768).default(2048),

  // Payment Gateways & Billing (Phase 9)
  BILLING_MODE: z.enum(['live', 'dev']).default('dev'),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_careergraph'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_sec_careergraph_testing_key_123'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_whsec_careergraph_testing_123'),
  STRIPE_SECRET_KEY: z.string().default('sk_test_careergraph_mock'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_careergraph_mock'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
