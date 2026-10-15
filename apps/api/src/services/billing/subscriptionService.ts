import { prisma } from '@careergraph/db';
import { env } from '../../config/env.js';
import { PlanService } from './planService.js';
import { InvoiceService } from './invoiceService.js';
import {
  PaymentGatewayProvider,
  CreateCheckoutParams,
  CheckoutResult,
} from './providers/paymentProvider.js';
import { FreeDevPaymentProvider } from './providers/freeDevProvider.js';
import { RazorpayPaymentProvider } from './providers/razorpayProvider.js';
import { StripePaymentProvider } from './providers/stripeProvider.js';
import {
  SubscriptionDto,
  PaymentProviderType,
  CreateCheckoutSessionInput,
  VerifyPaymentInput,
} from '@careergraph/shared';

export class SubscriptionService {
  private static freeDevProvider = new FreeDevPaymentProvider();
  private static razorpayProvider = new RazorpayPaymentProvider();
  private static stripeProvider = new StripePaymentProvider();

  /**
   * Resolves the appropriate payment provider.
   */
  static getProvider(
    requestedProvider?: PaymentProviderType,
    currency?: string
  ): PaymentGatewayProvider {
    if (requestedProvider === 'FREE_DEV' || env.BILLING_MODE === 'dev') {
      return this.freeDevProvider;
    }

    if (requestedProvider === 'RAZORPAY') {
      return this.razorpayProvider;
    }

    if (requestedProvider === 'STRIPE') {
      return this.stripeProvider;
    }

    // Default based on currency
    if (currency === 'INR') {
      return this.razorpayProvider;
    }

    return this.stripeProvider;
  }

  /**
   * Retrieves the current user subscription or creates/defaults to Free plan.
   */
  static async getUserSubscription(userId: string): Promise<SubscriptionDto> {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
        currentPeriodEnd: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (sub) {
      return this.toDto(sub);
    }

    // Default free plan representation
    const freePlan = await PlanService.getPlanByKey('FREE');
    return {
      id: `free_${userId}`,
      userId,
      planId: freePlan.id,
      plan: freePlan,
      provider: 'FREE_DEV',
      status: 'ACTIVE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      seatsCount: 1,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Initiates a checkout session for subscription upgrade or renewal.
   */
  static async createCheckoutSession(
    userId: string,
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const plan = await PlanService.getPlanByKey(input.planKey);

    // Free plan bypasses checkout
    if (plan.price === 0) {
      await this.activateSubscription({
        userId,
        planKey: plan.key,
        provider: 'FREE_DEV',
      });

      return {
        provider: 'FREE_DEV',
        orderId: `free_ord_${Date.now()}`,
        amount: 0,
        currency: input.currency,
        planKey: plan.key,
        planName: plan.name,
        isDevMode: true,
      };
    }

    const provider = this.getProvider(input.provider, input.currency);

    const checkoutParams: CreateCheckoutParams = {
      userId,
      userEmail: user.email,
      userName: user.name,
      plan,
      currency: input.currency,
      returnUrl: input.returnUrl,
      customerGstin: input.customerGstin,
      legalEntityName: input.legalEntityName,
      legalAddress: input.legalAddress,
    };

    return provider.createCheckoutSession(checkoutParams);
  }

  /**
   * Verifies payment and activates subscription.
   */
  static async verifyAndActivatePayment(
    userId: string,
    planKey: string,
    input: VerifyPaymentInput,
    gstDetails?: { customerGstin?: string | null; legalEntityName?: string | null; legalAddress?: string | null }
  ): Promise<SubscriptionDto> {
    const provider = this.getProvider(input.provider);

    const isValid = await provider.verifyPayment({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
      sessionId: input.sessionId,
    });

    if (!isValid) {
      throw new Error('Payment verification failed. Invalid signature or credentials.');
    }

    return this.activateSubscription({
      userId,
      planKey,
      provider: input.provider,
      providerOrderId: input.orderId || input.sessionId,
      providerPaymentId: input.paymentId || input.sessionId,
      customerGstin: gstDetails?.customerGstin,
      legalEntityName: gstDetails?.legalEntityName,
      legalAddress: gstDetails?.legalAddress,
    });
  }

  /**
   * Activates or upgrades a subscription in the database and generates a GST invoice.
   */
  static async activateSubscription(params: {
    userId: string;
    planKey: string;
    provider: PaymentProviderType;
    providerSubscriptionId?: string | null;
    providerOrderId?: string | null;
    providerPaymentId?: string | null;
    customerGstin?: string | null;
    legalEntityName?: string | null;
    legalAddress?: string | null;
  }): Promise<SubscriptionDto> {
    const plan = await PlanService.getPlanByKey(params.planKey);

    const now = new Date();
    const periodDays = plan.interval === 'ANNUAL' ? 365 : 30;
    const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    // Cancel / supersede any existing active subscriptions
    await prisma.subscription.updateMany({
      where: {
        userId: params.userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
        canceledAt: now,
      },
    });

    // Create new active subscription
    const sub = await prisma.subscription.create({
      data: {
        userId: params.userId,
        planId: plan.id,
        provider: params.provider as any,
        providerSubscriptionId: params.providerSubscriptionId || null,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      include: { plan: true },
    });

    // Generate GST invoice if price > 0
    if (plan.price > 0) {
      await InvoiceService.createInvoice({
        userId: params.userId,
        subscriptionId: sub.id,
        provider: params.provider,
        providerOrderId: params.providerOrderId,
        providerPaymentId: params.providerPaymentId,
        amount: plan.price,
        currency: plan.currency,
        planName: plan.name,
        customerGstin: params.customerGstin,
        legalEntityName: params.legalEntityName,
        legalAddress: params.legalAddress,
      });
    }

    return this.toDto(sub);
  }

  /**
   * Sets subscription to cancel at period end.
   */
  static async cancelSubscription(userId: string, atPeriodEnd: boolean = true): Promise<SubscriptionDto> {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      throw new Error('No active subscription found to cancel.');
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: atPeriodEnd,
        status: atPeriodEnd ? 'ACTIVE' : 'CANCELED',
        canceledAt: new Date(),
      },
      include: { plan: true },
    });

    return this.toDto(updated);
  }

  /**
   * Reactivates a canceled subscription that has not yet reached period end.
   */
  static async reactivateSubscription(userId: string): Promise<SubscriptionDto> {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      throw new Error('No pending cancellation found to reactivate.');
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      include: { plan: true },
    });

    return this.toDto(updated);
  }

  static toDto(sub: any): SubscriptionDto {
    return {
      id: sub.id,
      userId: sub.userId,
      orgId: sub.orgId,
      planId: sub.planId,
      plan: sub.plan ? PlanService.toDto(sub.plan) : undefined,
      provider: sub.provider,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt?.toISOString(),
      trialEnd: sub.trialEnd?.toISOString(),
      seatsCount: sub.seatsCount,
      createdAt: sub.createdAt.toISOString(),
    };
  }
}
