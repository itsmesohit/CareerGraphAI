import crypto from 'crypto';
import {
  PaymentGatewayProvider,
  CreateCheckoutParams,
  CheckoutResult,
  VerifyPaymentParams,
  WebhookVerificationResult,
} from './paymentProvider.js';

export class FreeDevPaymentProvider implements PaymentGatewayProvider {
  providerType = 'FREE_DEV' as const;

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const mockOrderId = `dev_ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const returnUrl = params.returnUrl || 'http://localhost:5173/billing';

    return {
      provider: 'FREE_DEV',
      orderId: mockOrderId,
      sessionId: `dev_sess_${Date.now()}`,
      checkoutUrl: `${returnUrl}?dev_success=true&order_id=${mockOrderId}&plan=${params.plan.key}`,
      amount: params.plan.price,
      currency: params.currency,
      planKey: params.plan.key,
      planName: params.plan.name,
      isDevMode: true,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    // In dev mode, orders starting with 'dev_' or having a paymentId are verified
    return !!(params.orderId || params.paymentId || params.sessionId);
  }

  async verifyWebhook(
    rawBody: string | Buffer,
    signature: string,
    headers?: Record<string, string | string[] | undefined>
  ): Promise<WebhookVerificationResult> {
    try {
      const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
      const eventId = payload.id || `dev_evt_${Date.now()}`;
      const eventType = payload.event || payload.type || 'dev.payment.success';

      return {
        isValid: true,
        eventId,
        eventType,
        payload,
        userId: payload.userId || payload.metadata?.userId,
        planKey: payload.planKey || payload.metadata?.planKey,
        amount: payload.amount,
        currency: payload.currency || 'INR',
        providerPaymentId: payload.paymentId || `dev_pay_${Date.now()}`,
        providerOrderId: payload.orderId || `dev_ord_${Date.now()}`,
      };
    } catch {
      return {
        isValid: false,
        eventId: 'invalid',
        eventType: 'unknown',
        payload: null,
      };
    }
  }
}
