import { z } from 'zod';

export const IntegrationProviderEnum = z.enum([
  'GMAIL',
  'OUTLOOK',
  'GOOGLE_CALENDAR',
  'OUTLOOK_CALENDAR',
]);
export type IntegrationProvider = z.infer<typeof IntegrationProviderEnum>;

export const IntegrationStatusEnum = z.enum([
  'CONNECTED',
  'DISCONNECTED',
  'REVOKED',
  'EXPIRED',
]);
export type IntegrationStatus = z.infer<typeof IntegrationStatusEnum>;

export const InitiateOAuthSchema = z.object({
  provider: IntegrationProviderEnum,
  redirectUri: z.string().url().optional(),
});
export type InitiateOAuthInput = z.infer<typeof InitiateOAuthSchema>;

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  provider: IntegrationProviderEnum,
  redirectUri: z.string().url().optional(),
});
export type OAuthCallbackInput = z.infer<typeof OAuthCallbackSchema>;

export const ConnectManualIntegrationSchema = z.object({
  provider: IntegrationProviderEnum,
  accountEmail: z.string().email(),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresInSeconds: z.number().optional(),
  scopes: z.array(z.string()).default([]),
});
export type ConnectManualIntegrationInput = z.infer<typeof ConnectManualIntegrationSchema>;

export interface IntegrationDTO {
  id: string;
  provider: IntegrationProvider;
  accountEmail: string;
  status: IntegrationStatus;
  scopes: string[];
  lastSyncedAt?: string | null;
  createdAt: string;
  metadata?: Record<string, any> | null;
}

export interface OAuthAuthorizeUrlDTO {
  provider: IntegrationProvider;
  authorizeUrl: string;
  state: string;
}
