import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  API_BASE_URL: z.string().default('http://localhost:3001/api/v1'),
  
  // FalkorDB
  FALKORDB_HOST: z.string().default('127.0.0.1'),
  FALKORDB_PORT: z.coerce.number().default(6379),
  FALKORDB_USERNAME: z.string().optional(),
  FALKORDB_PASSWORD: z.string().optional(),
  FALKORDB_GRAPH_ID: z.string().default('careergraph'),
  
  // Database & Cache
  DATABASE_URL: z.string().default('file:./dev.db'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  
  // Auth
  JWT_SECRET: z.string().default('careergraph-secret-jwt-key-2026-falkordb-hacks'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // AI
  LLM_PROVIDER: z.enum(['mock', 'gemini', 'openai', 'anthropic']).default('mock'),
  LLM_API_KEY: z.string().optional(),
  
  // Job Sources
  REMOTIVE_ENABLED: z.coerce.boolean().default(true),
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  
  // Email & OTP
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('CareerGraph AI <verify@codingspark.in>'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Integrations
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
