import { Router } from 'express';
import { EmailService } from '../modules/email/emailService.js';
import { env } from '../config/env.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * Public or Authenticated Domain Status Info
 */
router.get('/status', (req, res) => {
  return res.json({
    domain: 'codingspark.in',
    status: 'VERIFIED',
    senderEmail: env.RESEND_FROM_EMAIL,
    provider: 'Resend',
    resendConfigured: Boolean(env.RESEND_API_KEY),
    channels: [
      {
        id: 'otp',
        name: 'Account Registration OTP',
        sender: env.RESEND_FROM_EMAIL,
        trigger: 'Candidate sign up or new login code request',
        status: 'ACTIVE',
      },
      {
        id: 'missing-info',
        name: 'Missing Information Alert',
        sender: env.RESEND_FROM_EMAIL,
        trigger: 'Job application paused at WAITING_FOR_USER',
        status: 'ACTIVE',
      },
      {
        id: 'approval',
        name: 'Application Approval Request',
        sender: env.RESEND_FROM_EMAIL,
        trigger: 'Application prepared and locked for user approval',
        status: 'ACTIVE',
      },
      {
        id: 'submission',
        name: 'Submission Confirmation',
        sender: env.RESEND_FROM_EMAIL,
        trigger: 'Application successfully submitted to company ATS',
        status: 'ACTIVE',
      },
      {
        id: 'outreach',
        name: 'Approved Recruiter Outreach',
        sender: env.RESEND_FROM_EMAIL,
        trigger: 'Candidate approves and dispatches recruiter email',
        status: 'ACTIVE',
      },
    ],
  });
});

/**
 * Send Test Notification Email via Resend from Verified Domain
 */
router.post('/test', async (req, res) => {
  try {
    const { toEmail, message } = req.body;
    const recipient = (toEmail || '').trim();

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient email address is required.' });
    }

    console.log(`[Notification Route] Dispatching test notification to ${recipient}...`);
    const result = await EmailService.sendTestNotificationEmail(recipient, message);

    return res.json({
      success: true,
      message: `Test notification sent successfully from verified domain codingspark.in!`,
      deliveryId: result.id,
      provider: result.provider,
      sender: result.from,
      recipient: result.to,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Notification Test Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch test notification' });
  }
});

export default router;
