import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

export class EmailService {
  private static resendClient = new Resend(env.RESEND_API_KEY);

  private static smtpTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  /**
   * Helper: Dispatches an email via verified Resend domain, with automatic SMTP fallback
   */
  private static async dispatchEmail(params: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<{ success: boolean; provider: 'RESEND' | 'SMTP'; id?: string; from: string; to: string }> {
    const fromAddress = params.from || env.RESEND_FROM_EMAIL;

    // 1. Primary: Resend API with verified domain
    try {
      console.log(`[EmailService] Sending email via Resend (from: ${fromAddress}, to: ${params.to}, subject: "${params.subject}")...`);
      const { data, error } = await this.resendClient.emails.send({
        from: fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      if (error) {
        console.warn(`[EmailService] Resend API returned error:`, error);
        throw new Error(error.message || 'Resend delivery failed');
      }

      console.log(`[EmailService] Delivered via Resend verified domain. ID: ${data?.id}`);
      return { success: true, provider: 'RESEND', id: data?.id, from: fromAddress, to: params.to };
    } catch (resendErr: any) {
      console.warn(`[EmailService] Resend delivery encountered error (${resendErr.message}). Switching to SMTP fallback...`);

      // 2. Fallback: SMTP
      try {
        const info = await this.smtpTransporter.sendMail({
          from: fromAddress,
          to: params.to,
          subject: params.subject,
          html: params.html,
        });
        console.log(`[EmailService] Delivered via SMTP fallback. ID: ${info.messageId}`);
        return { success: true, provider: 'SMTP', id: info.messageId, from: fromAddress, to: params.to };
      } catch (smtpErr: any) {
        console.error(`[EmailService] Both Resend and SMTP delivery failed:`, smtpErr.message);
        throw new Error(`Email dispatch failed: ${smtpErr.message}`);
      }
    }
  }

  /**
   * Sends 6-digit OTP verification code on account creation
   */
  static async sendOtpVerificationEmail(toEmail: string, otpCode: string, userName?: string) {
    const name = userName || 'there';
    const subject = `Your CareerGraph AI Verification Code: ${otpCode}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f1f5f9; padding: 24px; margin: 0; }
    .container { max-width: 520px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .logo { font-size: 20px; font-weight: 800; color: #ffffff; margin-bottom: 24px; }
    .logo-badge { background: #6366f1; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px; margin-left: 8px; }
    .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
    .otp-box { background: #1e1b4b; border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
    .footer { font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      CareerGraph<span style="color: #6366f1;">.ai</span>
      <span class="logo-badge">FalkorDB Verified Domain</span>
    </div>
    <div class="title">Verify Your Career Workspace</div>
    <p class="text">Hi ${name},<br><br>Thank you for creating your account on CareerGraph AI. Please enter the 6-digit verification code below to verify your email and activate your tenant graph memory:</p>
    
    <div class="otp-box">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a5b4fc; margin-bottom: 6px; font-weight: 600;">One-Time Verification Code</div>
      <div class="otp-code">${otpCode}</div>
    </div>

    <p class="text" style="font-size: 12px;">This code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>

    <div class="footer">
      CareerGraph AI &bull; Sent from verified domain via Resend<br>
      FalkorDB Graph Hacks Hackathon 2026
    </div>
  </div>
</body>
</html>
    `;

    return this.dispatchEmail({ to: toEmail, subject, html });
  }

  /**
   * Sends workflow notification email (Missing Info alert, Approval alert, Submission result)
   */
  static async sendNotificationEmail(params: {
    toEmail: string;
    subject: string;
    heading: string;
    messageText: string;
    badgeText?: string;
    badgeColor?: string;
    metadata?: Array<{ label: string; value: string }>;
    actionLabel?: string;
    actionUrl?: string;
  }) {
    const badge = params.badgeText
      ? `<span style="background: ${params.badgeColor || '#6366f1'}; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; margin-bottom: 12px;">${params.badgeText}</span><br>`
      : '';

    const metadataRows = params.metadata && params.metadata.length > 0
      ? `
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px 18px; margin: 18px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            ${params.metadata.map(m => `
              <tr>
                <td style="color: #94a3b8; padding: 4px 0; font-weight: 500;">${m.label}:</td>
                <td style="color: #f8fafc; font-weight: 600; text-align: right; padding: 4px 0;">${m.value}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `
      : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f1f5f9; padding: 24px; margin: 0; }
    .container { max-width: 560px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .logo { font-size: 20px; font-weight: 800; color: #ffffff; margin-bottom: 24px; }
    .logo-badge { background: #0284c7; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px; margin-left: 8px; font-weight: 600; }
    .title { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .footer { font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      CareerGraph<span style="color: #6366f1;">.ai</span>
      <span class="logo-badge">Verified Domain: codingspark.in</span>
    </div>
    ${badge}
    <div class="title">${params.heading}</div>
    <div class="text">${params.messageText}</div>
    ${metadataRows}
    ${params.actionLabel && params.actionUrl ? `<a href="${params.actionUrl}" class="btn">${params.actionLabel} &rarr;</a>` : ''}
    <div class="footer">
      CareerGraph AI Autonomous Notification &bull; Sent from verified domain <strong>verify@codingspark.in</strong> via Resend<br>
      FalkorDB Graph Hacks Hackathon 2026
    </div>
  </div>
</body>
</html>
    `;

    return this.dispatchEmail({ to: params.toEmail, subject: params.subject, html });
  }

  /**
   * Dispatches a live test notification from verified domain codingspark.in
   */
  static async sendTestNotificationEmail(toEmail: string, customMessage?: string) {
    const subject = `[Test Notification] CareerGraph AI Verified Domain Delivery (codingspark.in)`;
    const heading = `Verified Domain Notification Active!`;
    const messageText = customMessage || `
      This is a real-time test notification sent directly through <strong>Resend</strong> using your verified domain <strong>codingspark.in</strong>.<br><br>
      All candidate notifications, 6-digit OTP verification codes, missing information requests, and application approval alerts are now actively routed from <strong>${env.RESEND_FROM_EMAIL}</strong>.
    `;

    return this.sendNotificationEmail({
      toEmail,
      subject,
      heading,
      messageText,
      badgeText: 'Verified Domain Active',
      badgeColor: '#059669',
      metadata: [
        { label: 'Sender', value: env.RESEND_FROM_EMAIL },
        { label: 'Domain', value: 'codingspark.in (Verified via Resend)' },
        { label: 'Email Provider', value: 'Resend API (HTTP/2)' },
        { label: 'Timestamp', value: new Date().toISOString() },
      ],
      actionLabel: 'Open CareerGraph AI Dashboard',
      actionUrl: env.FRONTEND_URL,
    });
  }

  /**
   * Sends verified candidate recruiter outreach email directly to the recruiter
   */
  static async sendRecruiterOutreachEmail(params: {
    toEmail: string;
    subject: string;
    bodyText: string;
    candidateName: string;
  }) {
    const formattedBody = params.bodyText.replace(/\n/g, '<br>');
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1e293b; padding: 24px; margin: 0; line-height: 1.6; font-size: 14px; }
    .content { max-width: 600px; margin: 0 auto; }
    .sig { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="content">
    <div>${formattedBody}</div>
    <div class="sig">
      Sent by ${params.candidateName} via CareerGraph AI Verified Outreach
    </div>
  </div>
</body>
</html>
    `;

    return this.dispatchEmail({ to: params.toEmail, subject: params.subject, html });
  }
}
