import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { PlanService } from '../services/billing/planService.js';
import { SubscriptionService } from '../services/billing/subscriptionService.js';
import { InvoiceService } from '../services/billing/invoiceService.js';
import { UsageService } from '../services/billing/usageService.js';
import { WebhookService } from '../services/billing/webhookService.js';
import {
  CreateCheckoutSessionInputSchema,
  VerifyPaymentInputSchema,
} from '@careergraph/shared';

export const billingRouter = Router();

function getUserId(req: Request): string {
  return (req as any).user?.userId || (req as any).user?.id || '';
}

/**
 * GET /api/v1/billing/plans
 * Public endpoint to list available subscription tiers.
 */
billingRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const tier = req.query.tier as 'INDIVIDUAL' | 'ORGANIZATION' | undefined;
    const plans = await PlanService.listPlans(tier);
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/webhooks/razorpay
 * Razorpay webhook handler with HMAC signature verification.
 */
billingRouter.post('/webhooks/razorpay', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const result = await WebhookService.handleRazorpayWebhook(rawBody, signature, req.headers as any);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/webhooks/stripe
 * Stripe webhook handler with signature verification.
 */
billingRouter.post('/webhooks/stripe', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['stripe-signature'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const result = await WebhookService.handleStripeWebhook(rawBody, signature, req.headers as any);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// All routes below require candidate authentication
billingRouter.use(requireAuth);

/**
 * GET /api/v1/billing/subscription
 * Retrieves candidate's current active plan & subscription.
 */
billingRouter.get('/subscription', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const subscription = await SubscriptionService.getUserSubscription(userId);
    res.json({ subscription });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/checkout
 * Initiates checkout session for plan upgrade or purchase.
 */
billingRouter.post('/checkout', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = CreateCheckoutSessionInputSchema.safeParse(req.body);

    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const session = await SubscriptionService.createCheckoutSession(userId, parse.data);
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/verify-payment
 * Confirms payment signature and activates plan.
 */
billingRouter.post('/verify-payment', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parse = VerifyPaymentInputSchema.safeParse(req.body);

    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const planKey = (req.body.planKey as string) || 'PRO_MONTHLY';
    const gstDetails = {
      customerGstin: req.body.customerGstin,
      legalEntityName: req.body.legalEntityName,
      legalAddress: req.body.legalAddress,
    };

    const subscription = await SubscriptionService.verifyAndActivatePayment(
      userId,
      planKey,
      parse.data,
      gstDetails
    );

    res.json({ subscription, message: 'Subscription successfully activated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/cancel
 * Schedules subscription cancellation at period end.
 */
billingRouter.post('/cancel', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const atPeriodEnd = req.body.atPeriodEnd !== false;

    const subscription = await SubscriptionService.cancelSubscription(userId, atPeriodEnd);
    res.json({ subscription, message: 'Subscription scheduled for cancellation.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/reactivate
 * Reactivates a pending cancelled subscription.
 */
billingRouter.post('/reactivate', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const subscription = await SubscriptionService.reactivateSubscription(userId);
    res.json({ subscription, message: 'Subscription successfully reactivated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/billing/usage
 * Returns real-time meters and quota limits for the candidate.
 */
billingRouter.get('/usage', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const usage = await UsageService.getUsageSummary(userId);
    res.json({ usage });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/usage/record
 * Increments usage resource (discoveryRuns, outreachEmails, tailoredResumes, etc.)
 */
billingRouter.post('/usage/record', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { resource, amount } = req.body;

    if (!resource) {
      res.status(400).json({ error: 'resource is required' });
      return;
    }

    await UsageService.incrementUsage(userId, resource, amount || 1);
    const usage = await UsageService.getUsageSummary(userId);
    res.json({ usage, message: 'Usage recorded successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/billing/invoices
 * Lists all invoices for the candidate.
 */
billingRouter.get('/invoices', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const invoices = await InvoiceService.listUserInvoices(userId);
    res.json({ invoices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/billing/invoices/:id
 * Fetches single invoice.
 */
billingRouter.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const invoice = await InvoiceService.getInvoiceById(req.params.id, userId);

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json({ invoice });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/billing/invoices/:id/download
 * Renders printable GST tax invoice in HTML.
 */
billingRouter.get('/invoices/:id/download', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const user = (req as any).user;
    const invoice = await InvoiceService.getInvoiceById(req.params.id, userId);

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const html = InvoiceService.renderInvoiceHtml(
      invoice,
      user?.name || 'Valued Candidate',
      user?.email || 'candidate@example.com'
    );

    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Tax_Invoice_${invoice.invoiceNumber}.html"`
    );
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
