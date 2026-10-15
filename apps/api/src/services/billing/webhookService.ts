import { prisma } from '@careergraph/db';
import { PaymentProviderType } from '@careergraph/shared';
import { SubscriptionService } from './subscriptionService.js';
import { RazorpayPaymentProvider } from './providers/razorpayProvider.js';
import { StripePaymentProvider } from './providers/stripeProvider.js';

export class WebhookService {
  private static razorpayProvider = new RazorpayPaymentProvider();
  private static stripeProvider = new StripePaymentProvider();

  /**
   * Processes Razorpay webhook events with signature verification and idempotent deduplication.
   */
  static async handleRazorpayWebhook(
    rawBody: string | Buffer,
    signature: string,
    headers?: Record<string, string | string[] | undefined>
  ): Promise<{ status: 'SUCCESS' | 'DUPLICATE' | 'IGNORED'; message: string }> {
    const verified = await this.razorpayProvider.verifyWebhook(rawBody, signature, headers);

    if (!verified.isValid) {
      throw new Error('Invalid Razorpay webhook signature');
    }

    return this.processWebhookEvent('RAZORPAY', verified);
  }

  /**
   * Processes Stripe webhook events with signature verification and idempotent deduplication.
   */
  static async handleStripeWebhook(
    rawBody: string | Buffer,
    signature: string,
    headers?: Record<string, string | string[] | undefined>
  ): Promise<{ status: 'SUCCESS' | 'DUPLICATE' | 'IGNORED'; message: string }> {
    const verified = await this.stripeProvider.verifyWebhook(rawBody, signature, headers);

    if (!verified.isValid) {
      throw new Error('Invalid Stripe webhook signature');
    }

    return this.processWebhookEvent('STRIPE', verified);
  }

  /**
   * Core idempotent processor for verified webhook events.
   */
  private static async processWebhookEvent(
    provider: PaymentProviderType,
    verified: {
      eventId: string;
      eventType: string;
      payload: any;
      userId?: string;
      planKey?: string;
      providerPaymentId?: string;
      providerOrderId?: string;
    }
  ): Promise<{ status: 'SUCCESS' | 'DUPLICATE' | 'IGNORED'; message: string }> {
    // 1. Idempotency Check: check if eventId already processed
    const existing = await prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: provider as any,
          eventId: verified.eventId,
        },
      },
    });

    if (existing) {
      return {
        status: 'DUPLICATE',
        message: `Webhook event ${verified.eventId} was already processed.`,
      };
    }

    // 2. Record pending event in the ledger
    const webhookRecord = await prisma.paymentWebhookEvent.create({
      data: {
        provider: provider as any,
        eventId: verified.eventId,
        eventType: verified.eventType,
        payload: verified.payload as any,
        status: 'SUCCESS',
        processedAt: new Date(),
      },
    });

    // 3. Process event types
    const successEvents = [
      'payment.captured',
      'order.paid',
      'subscription.activated',
      'checkout.session.completed',
      'invoice.payment_succeeded',
    ];

    if (successEvents.includes(verified.eventType) && verified.userId && verified.planKey) {
      await SubscriptionService.activateSubscription({
        userId: verified.userId,
        planKey: verified.planKey,
        provider,
        providerOrderId: verified.providerOrderId,
        providerPaymentId: verified.providerPaymentId,
      });

      return {
        status: 'SUCCESS',
        message: `Subscription successfully activated for user ${verified.userId} with plan ${verified.planKey}`,
      };
    }

    return {
      status: 'IGNORED',
      message: `Webhook event ${verified.eventType} acknowledged without action.`,
    };
  }
}
