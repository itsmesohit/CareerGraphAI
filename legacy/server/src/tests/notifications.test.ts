import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Resend Verified Domain & Notification Routes', () => {
  it('returns domain verification status and active notification channels', async () => {
    const res = await request(app).get('/api/v1/notifications/status');
    expect(res.status).toBe(200);
    expect(res.body.domain).toBe('codingspark.in');
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.senderEmail).toContain('verify@codingspark.in');
    expect(res.body.resendConfigured).toBe(true);
    expect(Array.isArray(res.body.channels)).toBe(true);
    expect(res.body.channels.length).toBeGreaterThan(0);
  });

  it('rejects test notification when recipient email is missing', async () => {
    const res = await request(app).post('/api/v1/notifications/test').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Recipient email address is required');
  });
});
