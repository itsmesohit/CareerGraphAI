import { z } from 'zod';
import {
  PlanTierEnum,
  BillingIntervalEnum,
  PaymentProviderTypeEnum,
  SubscriptionStatusEnum,
  InvoiceStatusEnum,
} from './enums.js';

export const PlanEntitlementsSchema = z.object({
  discoveryRunsPerDay: z.number().int().nonnegative().default(5),
  matchedJobsVisible: z.number().int().nonnegative().default(10),
  preparedApplicationsPerMonth: z.number().int().nonnegative().default(5),
  autoApplyAllowancePerMonth: z.number().int().nonnegative().default(0),
  tailoredResumesPerMonth: z.number().int().nonnegative().default(3),
  aiTokensMonthly: z.number().int().nonnegative().default(25000),
  outreachEmailsPerDay: z.number().int().nonnegative().default(0),
  mailboxTracking: z.boolean().default(false),
  extensionAccess: z.boolean().default(false),
  exportData: z.boolean().default(false),
});
export type PlanEntitlements = z.infer<typeof PlanEntitlementsSchema>;

export const PlanDtoSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  tier: PlanTierEnum,
  price: z.number().int().nonnegative(),
  currency: z.string(),
  interval: BillingIntervalEnum,
  isActive: z.boolean(),
  isPopular: z.boolean().optional(),
  entitlements: PlanEntitlementsSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type PlanDto = z.infer<typeof PlanDtoSchema>;

export const CreateCheckoutSessionInputSchema = z.object({
  planKey: z.string().min(1, 'planKey is required'),
  currency: z.enum(['INR', 'USD']).default('INR'),
  provider: PaymentProviderTypeEnum.optional(),
  returnUrl: z.string().url().optional(),
  customerGstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian GSTIN format')
    .optional()
    .nullable()
    .or(z.literal('')),
  legalEntityName: z.string().max(255).optional().nullable(),
  legalAddress: z.string().max(500).optional().nullable(),
});
export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionInputSchema>;

export const CheckoutSessionResponseSchema = z.object({
  provider: PaymentProviderTypeEnum,
  orderId: z.string().optional(),
  sessionId: z.string().optional(),
  checkoutUrl: z.string().optional(),
  keyId: z.string().optional(),
  amount: z.number().int(),
  currency: z.string(),
  planKey: z.string(),
  planName: z.string(),
  isDevMode: z.boolean().optional(),
});
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;

export const VerifyPaymentInputSchema = z.object({
  provider: PaymentProviderTypeEnum,
  orderId: z.string().optional(),
  paymentId: z.string().optional(),
  signature: z.string().optional(),
  sessionId: z.string().optional(),
});
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentInputSchema>;

export const SubscriptionDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  orgId: z.string().nullable().optional(),
  planId: z.string(),
  plan: PlanDtoSchema.optional(),
  provider: PaymentProviderTypeEnum,
  status: SubscriptionStatusEnum,
  currentPeriodStart: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().nullable().optional(),
  trialEnd: z.string().nullable().optional(),
  seatsCount: z.number().int().default(1),
  createdAt: z.string().optional(),
});
export type SubscriptionDto = z.infer<typeof SubscriptionDtoSchema>;

export const InvoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().int().default(1),
  unitPrice: z.number().int(),
  amount: z.number().int(),
});
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

export const InvoiceDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  orgId: z.string().nullable().optional(),
  subscriptionId: z.string().nullable().optional(),
  invoiceNumber: z.string(),
  provider: PaymentProviderTypeEnum,
  subtotal: z.number().int(),
  taxAmount: z.number().int(),
  total: z.number().int(),
  currency: z.string(),
  status: InvoiceStatusEnum,
  customerGstin: z.string().nullable().optional(),
  legalEntityName: z.string().nullable().optional(),
  legalAddress: z.string().nullable().optional(),
  sacCode: z.string(),
  lineItems: z.array(InvoiceLineItemSchema),
  paidAt: z.string().nullable().optional(),
  pdfUrl: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type InvoiceDto = z.infer<typeof InvoiceDtoSchema>;

export const UsageQuotaItemSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});
export type UsageQuotaItem = z.infer<typeof UsageQuotaItemSchema>;

export const UsageSummaryDtoSchema = z.object({
  plan: PlanDtoSchema,
  subscription: SubscriptionDtoSchema.nullable().optional(),
  quotas: z.object({
    discoveryRuns: UsageQuotaItemSchema,
    applicationsPrepared: UsageQuotaItemSchema,
    autoAppliesExecuted: UsageQuotaItemSchema,
    tailoredResumes: UsageQuotaItemSchema,
    outreachEmails: UsageQuotaItemSchema,
    aiTokens: UsageQuotaItemSchema,
  }),
  features: z.object({
    mailboxTracking: z.boolean(),
    extensionAccess: z.boolean(),
    exportData: z.boolean(),
  }),
});
export type UsageSummaryDto = z.infer<typeof UsageSummaryDtoSchema>;
