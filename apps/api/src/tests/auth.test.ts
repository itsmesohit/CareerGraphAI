import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app.js';
import { prisma } from '@careergraph/db';
import { sha256 } from '../utils/crypto.js';

const app = createApp();

describe('CareerGraph Authentication & Security System (Spec Section 5)', () => {
  const testEmail = `candidate_${Date.now()}@example.com`;
  const strongPassword = 'SecurePassword123!';
  const candidateName = 'Sarah Jenkins';

  beforeAll(async () => {
    // Clean up any test users
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Rejects registration with a weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Weak',
        email: 'weak@example.com',
        password: 'weak', // Fails strength rules
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('2. Registers a new candidate and generates single-use hashed OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: candidateName,
        email: testEmail,
        password: strongPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requiresVerification).toBe(true);
    expect(res.body.data.email).toBe(testEmail);

    // Verify user in PostgreSQL is created as UNVERIFIED
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.isEmailVerified).toBe(false);

    // Verify OTP record exists and is stored as hash, NOT plaintext
    const otp = await prisma.otpCode.findFirst({
      where: { email: testEmail, purpose: 'VERIFY_EMAIL' },
    });
    expect(otp).not.toBeNull();
    expect(otp?.codeHash).toHaveLength(64); // SHA-256 is 64 hex characters
    expect(otp?.attempts).toBe(0);
    expect(otp?.usedAt).toBeNull();
  });

  it('3. Enforces 60-second cooldown on resending OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/resend-otp')
      .send({
        email: testEmail,
        purpose: 'VERIFY_EMAIL',
      });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RESEND_RESTRICTED');
    expect(res.body.message).toMatch(/wait \d+ seconds/);
  });

  it('4. Rejects invalid OTP and tracks attempts', async () => {
    // Provide a wrong code
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        code: '000000',
        purpose: 'VERIFY_EMAIL',
      });

    expect(res.status).toBe(400);
    expect(res.body.attemptsRemaining).toBe(4);

    const otp = await prisma.otpCode.findFirst({
      where: { email: testEmail, purpose: 'VERIFY_EMAIL' },
    });
    expect(otp?.attempts).toBe(1);
  });

  it('5. Locks out when max 5 verification attempts are exceeded', async () => {
    const otp = await prisma.otpCode.findFirst({
      where: { email: testEmail, purpose: 'VERIFY_EMAIL' },
    });
    expect(otp).not.toBeNull();

    // Set attempts to 5
    await prisma.otpCode.update({
      where: { id: otp!.id },
      data: { attempts: 5 },
    });

    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        code: '123456',
        purpose: 'VERIFY_EMAIL',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('6. Rejects expired OTP codes', async () => {
    // Reset attempts and set expiresAt to 1 hour ago
    const otp = await prisma.otpCode.findFirst({
      where: { email: testEmail, purpose: 'VERIFY_EMAIL' },
    });

    await prisma.otpCode.update({
      where: { id: otp!.id },
      data: {
        attempts: 0,
        expiresAt: new Date(Date.now() - 3600 * 1000), // Expired
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        code: '123456',
        purpose: 'VERIFY_EMAIL',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EXPIRED_OR_NOT_FOUND');
  });

  it('7. Successfully verifies valid OTP, marks user verified, and issues session tokens', async () => {
    // Reset OTP with known code '987654' and valid 10-minute expiry
    const otp = await prisma.otpCode.findFirst({
      where: { email: testEmail, purpose: 'VERIFY_EMAIL' },
    });

    await prisma.otpCode.update({
      where: { id: otp!.id },
      data: {
        codeHash: sha256('987654'),
        attempts: 0,
        expiresAt: new Date(Date.now() + 600 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        code: '987654',
        purpose: 'VERIFY_EMAIL',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.isEmailVerified).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    // Verify cookie was set with refresh token
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/cg_refresh_token=/);

    // Verify user in DB is marked verified
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(dbUser?.isEmailVerified).toBe(true);

    // Verify OTP is single-use: now usedAt is populated
    const usedOtp = await prisma.otpCode.findUnique({ where: { id: otp!.id } });
    expect(usedOtp?.usedAt).not.toBeNull();

    // Trying to verify again with the same code must fail
    const replayRes = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({
        email: testEmail,
        code: '987654',
        purpose: 'VERIFY_EMAIL',
      });
    expect(replayRes.status).toBe(400);
  });

  it('8. Authenticates verified user with password and returns session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: strongPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/cg_refresh_token=/);
  });

  it('9. Supports rotating refresh tokens and detects token reuse (Family Revocation)', async () => {
    // 1. Login to get initial refresh token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: strongPassword });

    const cookieStr = loginRes.headers['set-cookie'][0];
    const initialRefreshToken = cookieStr.match(/cg_refresh_token=([^;]+)/)![1];

    // 2. Perform legitimate token rotation
    const rotateRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `cg_refresh_token=${initialRefreshToken}`);

    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.data.accessToken).toBeDefined();

    const newCookieStr = rotateRes.headers['set-cookie'][0];
    const newRefreshToken = newCookieStr.match(/cg_refresh_token=([^;]+)/)![1];
    expect(newRefreshToken).not.toBe(initialRefreshToken);

    // 3. TOKEN REUSE ATTACK SIMULATION:
    // Present the OLD, already rotated token again!
    const attackRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `cg_refresh_token=${initialRefreshToken}`);

    expect(attackRes.status).toBe(401);
    expect(attackRes.body.code).toBe('REFRESH_FAILED');
    expect(attackRes.body.message).toMatch(/reuse detected/i);

    // 4. Verify that the NEW refresh token in the same family has ALSO been revoked!
    const familyCheckRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `cg_refresh_token=${newRefreshToken}`);

    expect(familyCheckRes.status).toBe(401);
  });

  it('10. Lists active sessions and allows logging out other devices', async () => {
    // Create session 1
    const s1 = await request(app)
      .post('/api/v1/auth/login')
      .set('User-Agent', 'MacBook Safari')
      .send({ email: testEmail, password: strongPassword });
    const token1 = s1.body.data.accessToken;

    // Create session 2
    await request(app)
      .post('/api/v1/auth/login')
      .set('User-Agent', 'iPhone Chrome')
      .send({ email: testEmail, password: strongPassword });

    // Fetch sessions using token 1
    const listRes = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${token1}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(2);

    // Revoke other devices
    const revokeRes = await request(app)
      .post('/api/v1/auth/sessions/revoke-others')
      .set('Authorization', `Bearer ${token1}`);

    expect(revokeRes.status).toBe(200);

    // List again: should only have 1 active session remaining
    const afterList = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${token1}`);

    expect(afterList.body.data).toHaveLength(1);
    expect(afterList.body.data[0].isCurrent).toBe(true);
  });
});

describe('Passwordless OTP Login — /auth/login/otp-verify (Spec Section 5)', () => {
  const loginEmail = `otplogin_${Date.now()}@example.com`;

  beforeAll(async () => {
    // Fresh account for the passwordless flow (email starts unverified)
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Maya Passwordless',
        email: loginEmail,
        password: 'SecurePassword123!',
      });
    expect(res.status).toBe(201);
  });

  it('11. Verifies a correct LOGIN code sent as { email, code } WITHOUT a purpose field', async () => {
    // Regression: the route previously validated with the generic OTP schema
    // that required `purpose`; the real web client omits it, so every correct
    // code failed with 400 VALIDATION_ERROR "Invalid code format."
    await prisma.otpCode.create({
      data: {
        email: loginEmail,
        codeHash: sha256('556677'),
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() + 600 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/login/otp-verify')
      .send({ email: loginEmail, code: '556677' }); // no purpose — on purpose

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(loginEmail);
    expect(res.headers['set-cookie'][0]).toMatch(/cg_refresh_token=/);

    // Passwordless login auto-verifies the email (service marks it verified)
    const dbUser = await prisma.user.findUnique({ where: { email: loginEmail } });
    expect(dbUser?.isEmailVerified).toBe(true);

    // OTP is single-use
    const usedOtp = await prisma.otpCode.findFirst({
      where: { email: loginEmail, purpose: 'LOGIN' },
    });
    expect(usedOtp?.usedAt).not.toBeNull();
  });

  it('12. Rejects a wrong LOGIN code with INVALID_CODE (not a validation error)', async () => {
    await prisma.otpCode.create({
      data: {
        email: loginEmail,
        codeHash: sha256('112233'),
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() + 600 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/login/otp-verify')
      .send({ email: loginEmail, code: '999999' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CODE');
  });

  it('13. Still rejects malformed codes (fewer than 6 digits)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login/otp-verify')
      .send({ email: loginEmail, code: '12' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Invalid code format.');
  });
});
