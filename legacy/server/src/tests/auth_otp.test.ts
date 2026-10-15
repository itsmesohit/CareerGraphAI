import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../db/prisma.js';

describe('Auth & Email OTP Verification Flow', () => {
  const testEmail = `test_candidate_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Jane Test Developer';

  it('generates a 6-digit OTP and creates verification record on registration', async () => {
    // We test the endpoint
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: testName,
      });

    // Verify OTP record is created
    const otpRecord = await prisma.otpVerification.findFirst({
      where: { email: testEmail },
      orderBy: { createdAt: 'desc' },
    });

    expect(otpRecord).toBeDefined();
    expect(otpRecord?.code).toMatch(/^\d{6}$/);
    expect(otpRecord?.verified).toBe(false);
  }, 15000);

  it('verifies the 6-digit OTP, provisions tenant graph, and issues JWT token', async () => {
    const otpRecord = await prisma.otpVerification.findFirst({
      where: { email: testEmail, verified: false },
      orderBy: { createdAt: 'desc' },
    });
    expect(otpRecord).toBeDefined();

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        code: otpRecord!.code,
      });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.token).toBeDefined();
    expect(verifyRes.body.user.email).toBe(testEmail);
    expect(verifyRes.body.user.tenantId).toBeDefined();

    // Verify User in DB is marked verified
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user?.isVerified).toBe(true);
  });

  it('authenticates verified user via standard login', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.email).toBe(testEmail);
  });

  it('rejects invalid OTP codes', async () => {
    const badRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        code: '999999',
      });

    expect(badRes.status).toBe(400);
    expect(badRes.body.error).toContain('Invalid or expired');
  });
});
