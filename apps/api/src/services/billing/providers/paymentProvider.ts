import { PlanDto, PaymentProviderType } from '@careergraph/shared';

export interface CreateCheckoutParams {
  userId: string;
  userEmail: string;
  userName: string;
  plan: PlanDto;
  currency: 'INR' | 'USD';
  returnUrl?: string;
  customerGstin?: string | null;
  legalEntityName?: string | null;
  legalAddress?: string | null;
}

export interface CheckoutResult {
  provider: PaymentProviderType;
  orderId?: string;
  sessionId?: string;
  checkoutUrl?: string;
  keyId?: string;
  amount: number;
  currency: string;
  planKey: string;
  planName: string;
  isDevMode?: boolean;
}

export interface VerifyPaymentParams {
  orderId?: string;
  paymentId?: string;
  signature?: string;
  sessionId?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  eventId: string;
  eventType: string;
  payload: any;
  userId?: string;
  planKey?: string;
  amount?: number;
  currency?: string;
  providerPaymentId?: string;
  providerOrderId?: string;
}

export interface PaymentGatewayProvider {
  providerType: PaymentProviderType;
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
  verifyWebhook(
    rawBody: string | Buffer,
    signature: string,
    headers?: Record<string, string | string[] | undefined>
  ): Promise<WebhookVerificationResult>;
}
