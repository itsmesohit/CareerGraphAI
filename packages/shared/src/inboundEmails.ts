import { z } from 'zod';
import { WorkflowStatus } from './enums.js';

export const EmailClassificationCategoryEnum = z.enum([
  'APPLICATION_ACKNOWLEDGED',
  'REJECTION',
  'INTERVIEW_INVITATION',
  'OFFER_RECEIVED',
  'GENERAL_UPDATE',
]);
export type EmailClassificationCategory = z.infer<typeof EmailClassificationCategoryEnum>;

export const ClassifyInboundEmailSchema = z.object({
  provider: z.string().default('GMAIL'),
  messageId: z.string().min(1, 'messageId is required'),
  senderEmail: z.string().email(),
  senderName: z.string().optional(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  snippet: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
});
export type ClassifyInboundEmailInput = z.infer<typeof ClassifyInboundEmailSchema>;

export const ResolveInboundEmailSchema = z.object({
  applySuggestedStatus: z.boolean().default(true),
  notes: z.string().optional(),
});
export type ResolveInboundEmailInput = z.infer<typeof ResolveInboundEmailSchema>;

export interface InboundEmailEventDTO {
  id: string;
  userId: string;
  applicationId?: string | null;
  company?: string | null;
  provider: string;
  messageId: string;
  senderEmail: string;
  senderName?: string | null;
  recipientEmail: string;
  subject: string;
  snippet?: string | null;
  receivedAt: string;
  classifiedCategory: EmailClassificationCategory;
  confidence: number;
  suggestedStatus?: string | null;
  autoApplied: boolean;
  isResolved: boolean;
  actionTaken?: string | null;
  createdAt: string;
}
