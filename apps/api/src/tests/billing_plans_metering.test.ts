import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';
import { InvoiceService } from '../services/billing/invoiceService.js';
import { UsageService } from '../services/billing/usageService.js';
import { env } from '../config/env.js';

const app = createApp();

describe('CareerGraph Phase 9: Plans, Billing & Metering (Spec §19, §20, §21)', () => {
  const testUserEmail = `billing_candidate_${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  let token: string;
  let userId: string;
  let invoiceId: string;

  beforeAll(async () => {
    // 1. Register candidate user
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Aditya Sharma',
      email: testUserEmail,
      password,
    });
    expect(regRes.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
    userId = user!.id;
    await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });

    // 2. Login
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUserEmail,
      password,
    });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.dailyUsageMeter.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.invoice.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('1. GET /api/v1/billing/plans returns seeded tiers with pricing & structured entitlements', async () => {
    const res = await request(app).get('/api/v1/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toBeInstanceOf(Array);
    expect(res.body.plans.length).toBeGreaterThanOrEqual(4);

    const freePlan = res.body.plans.find((p: any) => p.key === 'FREE');
    expect(freePlan).toBeDefined();
    expect(freePlan.price).toBe(0);
    expect(freePlan.entitlements.discoveryRunsPerDay).toBe(5);
    expect(freePlan.entitlements.autoApplyAllowancePerMonth).toBe(0);

    const proMonthly = res.body.plans.find((p: any) => p.key === 'PRO_MONTHLY');
    expect(proMonthly).toBeDefined();
    expect(proMonthly.price).toBe(99900); // ₹999 in paise
    expect(proMonthly.isPopular).toBe(true);
    expect(proMonthly.entitlements.outreachEmailsPerDay).toBe(25);
    expect(proMonthly.entitlements.extensionAccess).toBe(true);
  });

  it('2. GET /api/v1/billing/subscription defaults new user to FREE plan', async () => {
    const res = await request(app)
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription).toBeDefined();
    expect(res.body.subscription.status).toBe('ACTIVE');
    expect(res.body.subscription.plan.key).toBe('FREE');
  });

  it('3. POST /api/v1/billing/checkout generates checkout session with correct pricing and metadata', async () => {
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planKey: 'PRO_MONTHLY',
        currency: 'INR',
        provider: 'RAZORPAY',
        customerGstin: '07AAAAA0000A1Z5',
        legalEntityName: 'Acme Software LLP',
      });

    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.amount).toBe(99900);
    expect(res.body.session.currency).toBe('INR');
    expect(res.body.session.planKey).toBe('PRO_MONTHLY');
    expect(res.body.session.orderId).toBeDefined();
  });

  it('4. POST /api/v1/billing/verify-payment activates PRO subscription and generates GST Tax Invoice', async () => {
    const orderId = `order_test_${Date.now()}`;
    const paymentId = `pay_test_${Date.now()}`;

    // Generate valid HMAC signature
    const signature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const res = await request(app)
      .post('/api/v1/billing/verify-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'RAZORPAY',
        planKey: 'PRO_MONTHLY',
        orderId,
        paymentId,
        signature,
        customerGstin: '07AAAAA0000A1Z5',
        legalEntityName: 'Acme Software LLP',
        legalAddress: 'Connaught Place, New Delhi - 110001',
      });

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('ACTIVE');
    expect(res.body.subscription.plan.key).toBe('PRO_MONTHLY');
  });

  it('5. GST Tax Invoices: verifies 18% calculation, SAC 998314, and printable HTML invoice rendering', async () => {
    // 1. List invoices
    const listRes = await request(app)
      .get('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.invoices.length).toBeGreaterThanOrEqual(1);

    const invoice = listRes.body.invoices[0];
    invoiceId = invoice.id;
    expect(invoice.invoiceNumber).toMatch(/^CG-\d{4}-\d{4}$/);
    expect(invoice.subtotal).toBe(99900); // ₹999.00
    expect(invoice.taxAmount).toBe(17982); // 18% GST of ₹999 = ₹179.82
    expect(invoice.total).toBe(117882); // ₹1,178.82
    expect(invoice.sacCode).toBe('998314');
    expect(invoice.customerGstin).toBe('07AAAAA0000A1Z5');

    // 2. Download HTML Tax invoice
    const htmlRes = await request(app)
      .get(`/api/v1/billing/invoices/${invoiceId}/download`)
      .set('Authorization', `Bearer ${token}`);

    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers['content-type']).toContain('text/html');
    expect(htmlRes.text).toContain('Tax Invoice');
    expect(htmlRes.text).toContain(InvoiceService.COMPANY_DETAILS.gstin);
    expect(htmlRes.text).toContain('998314');
    expect(htmlRes.text).toContain('Acme Software LLP');
    expect(htmlRes.text).toContain('CG-');
  });

  it('6. Webhooks & Idempotency: processes payment.captured and rejects duplicate replay events', async () => {
    const eventId = `evt_rzp_unique_${Date.now()}`;
    const webhookPayload = {
      id: eventId,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_webhook_${Date.now()}`,
            amount: 99900,
            currency: 'INR',
            notes: {
              userId,
              planKey: 'PRO_MONTHLY',
            },
          },
        },
      },
    };

    const payloadString = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');

    // First delivery -> SUCCESS
    const firstRes = await request(app)
      .post('/api/v1/billing/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payloadString);

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.status).toBe('SUCCESS');

    // Replay with exact same eventId -> DUPLICATE (idempotency ledger prevents double-crediting)
    const replayRes = await request(app)
      .post('/api/v1/billing/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payloadString);

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.status).toBe('DUPLICATE');
  });

  it('7. Webhooks: rejects tampering when HMAC signature is invalid', async () => {
    const invalidRes = await request(app)
      .post('/api/v1/billing/webhooks/razorpay')
      .set('x-razorpay-signature', 'tampered_invalid_hex_signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'payment.captured' }));

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error).toContain('Invalid Razorpay webhook signature');
  });

  it('8. Usage Meters & Quotas: tracks real-time usage and blocks when limits are exceeded', async () => {
    // 1. Initial usage summary
    const summaryRes = await request(app)
      .get('/api/v1/billing/usage')
      .set('Authorization', `Bearer ${token}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.usage.plan.key).toBe('PRO_MONTHLY');
    expect(summaryRes.body.usage.quotas.outreachEmails.limit).toBe(25);
    expect(summaryRes.body.usage.features.extensionAccess).toBe(true);

    // 2. Record 5 outreach emails used
    const recordRes = await request(app)
      .post('/api/v1/billing/usage/record')
      .set('Authorization', `Bearer ${token}`)
      .send({ resource: 'outreachEmails', amount: 5 });

    expect(recordRes.status).toBe(200);
    expect(recordRes.body.usage.quotas.outreachEmails.used).toBe(5);
    expect(recordRes.body.usage.quotas.outreachEmails.remaining).toBe(20);

    // 3. Test UsageService.checkQuota allows 10 more
    const checkAllowed = await UsageService.checkQuota(userId, 'outreachEmails', 10);
    expect(checkAllowed.allowed).toBe(true);

    // 4. Test UsageService.checkQuota rejects 25 more (exceeds remaining 20)
    const checkExceeded = await UsageService.checkQuota(userId, 'outreachEmails', 25);
    expect(checkExceeded.allowed).toBe(false);
  });

  it('9. Subscription Cancellation & Reactivation at period end', async () => {
    // 1. Schedule cancel at period end
    const cancelRes = await request(app)
      .post('/api/v1/billing/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ atPeriodEnd: true });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.subscription.cancelAtPeriodEnd).toBe(true);
    expect(cancelRes.body.subscription.status).toBe('ACTIVE'); // Stays active until period ends

    // 2. Reactivate subscription
    const reactivateRes = await request(app)
      .post('/api/v1/billing/reactivate')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.subscription.cancelAtPeriodEnd).toBe(false);
  });
});
