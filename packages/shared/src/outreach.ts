import { z } from 'zod';

export const OutreachStatusEnum = z.enum([
  'DRAFT',
  'APPROVED',
  'SENT',
  'FAILED',
  'CANCELLED',
]);
export type OutreachStatus = z.infer<typeof OutreachStatusEnum>;

export const GenerateOutreachDraftSchema = z.object({
  applicationId: z.string().optional(),
  company: z.string().min(1, 'Company is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientEmail: z.string().email('Valid recipient email is required'),
  context: z.string().optional(),
});
export type GenerateOutreachDraftInput = z.infer<typeof GenerateOutreachDraftSchema>;

export const UpdateOutreachDraftSchema = z.object({
  subject: z.string().min(1).optional(),
  bodyText: z.string().min(1).optional(),
  recipientName: z.string().min(1).optional(),
  recipientEmail: z.string().email().optional(),
  notes: z.string().optional(),
});
export type UpdateOutreachDraftInput = z.infer<typeof UpdateOutreachDraftSchema>;

export const ApproveOutreachDraftSchema = z.object({
  contentHash: z.string().min(1, 'Cryptographic content hash required to lock approval'),
});
export type ApproveOutreachDraftInput = z.infer<typeof ApproveOutreachDraftSchema>;

export const SendOutreachDraftSchema = z.object({
  contentHash: z.string().min(1, 'Cryptographic content hash required for dispatch verification'),
  provider: z.enum(['GMAIL', 'OUTLOOK', 'RESEND']).optional(),
});
export type SendOutreachDraftInput = z.infer<typeof SendOutreachDraftSchema>;

export interface OutreachDTO {
  id: string;
  userId: string;
  applicationId?: string | null;
  company: string;
  jobTitle: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  contentHash: string;
  status: OutreachStatus;
  approvedAt?: string | null;
  sentAt?: string | null;
  messageId?: string | null;
  provider?: string | null;
  followUpCount: number;
  lastFollowUpAt?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyOutreachQuotaDTO {
  sentToday: number;
  dailyLimit: number;
  remaining: number;
}
