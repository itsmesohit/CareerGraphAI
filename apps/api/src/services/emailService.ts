import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/env.js';

export interface SendOtpEmailParams {
  to: string;
  code: string;
  purpose: 'VERIFY_EMAIL' | 'LOGIN' | 'RESET_PASSWORD' | 'CHANGE_EMAIL' | 'SENSITIVE_ACTION';
  expiresInMinutes?: number;
}

export interface SendNotificationEmailParams {
  to: string;
  subject: string;
  heading: string;
  messageText: string;
  badgeText?: string;
  badgeColor?: string;
  metadata?: Array<{ label: string; value: string }>;
  actionLabel?: string;
  actionUrl?: string;
}

export interface EmailService {
  sendOtpEmail(params: SendOtpEmailParams): Promise<{ success: boolean; messageId?: string; previewUrl?: string }>;
  sendNotificationEmail(params: SendNotificationEmailParams): Promise<{ success: boolean; messageId?: string; previewUrl?: string }>;
}

function getPurposeTitle(purpose: SendOtpEmailParams['purpose']): string {
  switch (purpose) {
    case 'VERIFY_EMAIL':
      return 'Verify Your CareerGraph Account';
    case 'LOGIN':
      return 'Your CareerGraph Login Code';
    case 'RESET_PASSWORD':
      return 'Reset Your CareerGraph Password';
    case 'CHANGE_EMAIL':
      return 'Verify Email Address Change';
    case 'SENSITIVE_ACTION':
      return 'Authorize Sensitive Action';
  }
}

function getPurposeDescription(purpose: SendOtpEmailParams['purpose']): string {
  switch (purpose) {
    case 'VERIFY_EMAIL':
      return 'Use the verification code below to confirm your email and activate your CareerGraph AI account:';
    case 'LOGIN':
      return 'Use the verification code below to securely sign in to your CareerGraph AI workspace without a password:';
    case 'RESET_PASSWORD':
      return 'Use the one-time code below to verify your identity and reset your account password:';
    case 'CHANGE_EMAIL':
      return 'Use this code to confirm your new email address:';
    case 'SENSITIVE_ACTION':
      return 'Use this code to authorize this sensitive action in your account:';
  }
}

function renderOtpEmailHtml(params: SendOtpEmailParams): string {
  const title = getPurposeTitle(params.purpose);
  const description = getPurposeDescription(params.purpose);
  const expiry = params.expiresInMinutes || 10;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 40px 20px; }
    .container { max-width: 560px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; text-decoration: none; }
    .heading { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; }
    .description { font-size: 14px; color: #9ca3af; margin-bottom: 24px; line-height: 1.5; }
    .otp-box { background: #0f172a; border: 1px solid #38bdf8; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .otp-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #38bdf8; }
    .expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
    .security-note { font-size: 12px; color: #94a3b8; line-height: 1.6; border-left: 2px solid #38bdf8; padding-left: 12px; margin-top: 24px; }
    .footer { margin-top: 32px; border-top: 1px solid #1f2937; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <a href="#" class="logo">
      <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#38bdf8;"></span>
      CareerGraph AI
    </a>
    <h1 class="heading">${title}</h1>
    <p class="description">${description}</p>
    
    <div class="otp-box">
      <div class="otp-code">${params.code}</div>
      <div class="expiry">Expires in ${expiry} minutes</div>
    </div>

    <div class="security-note">
      This code is single-use and will expire automatically. If you did not initiate this request, you can safely ignore this email.
    </div>

    <div class="footer">
      CareerGraph AI &bull; Autonomous Graph-Powered SaaS Platform<br>
      Automated Security Notification &bull; Do not reply to this email
    </div>
  </div>
</body>
</html>
`;
}

function renderNotificationEmailHtml(params: SendNotificationEmailParams): string {
  const metaHtml = (params.metadata || [])
    .map(
      (m) => `
      <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px;">
        <span style="color: #94a3b8;">${m.label}</span>
        <span style="color: #f8fafc; font-weight: 600;">${m.value}</span>
      </div>`
    )
    .join('');

  const actionHtml = params.actionUrl
    ? `
    <div style="margin-top: 24px; text-align: center;">
      <a href="${params.actionUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0284c7, #4f46e5); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);">
        ${params.actionLabel || 'View in CareerGraph'}
      </a>
    </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${params.subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 40px 20px; }
    .container { max-width: 560px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 700; color: #38bdf8; margin-bottom: 24px; text-decoration: none; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
    .heading { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; }
    .message { font-size: 14px; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px; }
    .metadata-card { background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 20px 0; }
    .footer { margin-top: 32px; border-top: 1px solid #1f2937; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <a href="#" class="logo">
      <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#38bdf8;"></span>
      CareerGraph AI
    </a>
    ${
      params.badgeText
        ? `<div class="badge" style="background:${params.badgeColor || '#6366f1'}20; color:${params.badgeColor || '#6366f1'}; border:1px solid ${params.badgeColor || '#6366f1'}40;">${params.badgeText}</div>`
        : ''
    }
    <h1 class="heading">${params.heading}</h1>
    <div class="message">${params.messageText}</div>

    ${metaHtml ? `<div class="metadata-card">${metaHtml}</div>` : ''}
    ${actionHtml}

    <div class="footer">
      CareerGraph AI &bull; Autonomous Graph-Powered SaaS Platform<br>
      Application Lifecycle Notification &bull; Do not reply to this email
    </div>
  </div>
</body>
</html>
`;
}

class MailpitEmailService implements EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: '127.0.0.1',
      port: env.SMTP_PORT || 1025,
      secure: false,
      ignoreTLS: true,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendOtpEmail(params: SendOtpEmailParams) {
    const subject = `${params.code} is your CareerGraph code: ${getPurposeTitle(params.purpose)}`;
    const html = renderOtpEmailHtml(params);

    try {
      const info = await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: params.to,
        subject,
        html,
        text: `Your CareerGraph verification code is: ${params.code}. It will expire in ${params.expiresInMinutes || 10} minutes.`,
      });

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: `http://localhost:8025`,
      };
    } catch (err) {
      console.error('[MailpitEmailService] Failed to send email via Mailpit SMTP:', err);
      return { success: false };
    }
  }

  async sendNotificationEmail(params: SendNotificationEmailParams) {
    const html = renderNotificationEmailHtml(params);

    try {
      const info = await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        html,
        text: `${params.heading}\n\n${params.messageText}`,
      });

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: `http://localhost:8025`,
      };
    } catch (err) {
      console.error('[MailpitEmailService] Failed to send notification via Mailpit SMTP:', err);
      return { success: false };
    }
  }
}

class ResendEmailService implements EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY);
  }

  async sendOtpEmail(params: SendOtpEmailParams) {
    const subject = `${params.code} is your CareerGraph code: ${getPurposeTitle(params.purpose)}`;
    const html = renderOtpEmailHtml(params);

    try {
      const { data, error } = await this.resend.emails.send({
        from: env.RESEND_FROM_EMAIL || env.EMAIL_FROM,
        to: params.to,
        subject,
        html,
      });

      if (error) {
        console.error('[ResendEmailService] Resend API error:', error);
        return { success: false };
      }

      return { success: true, messageId: data?.id };
    } catch (err) {
      console.error('[ResendEmailService] Exception sending via Resend:', err);
      return { success: false };
    }
  }

  async sendNotificationEmail(params: SendNotificationEmailParams) {
    const html = renderNotificationEmailHtml(params);

    try {
      const { data, error } = await this.resend.emails.send({
        from: env.RESEND_FROM_EMAIL || env.EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        html,
      });

      if (error) {
        console.error('[ResendEmailService] Resend API error sending notification:', error);
        return { success: false };
      }

      return { success: true, messageId: data?.id };
    } catch (err) {
      console.error('[ResendEmailService] Exception sending notification via Resend:', err);
      return { success: false };
    }
  }
}

let activeEmailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (activeEmailService) return activeEmailService;

  if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
    activeEmailService = new ResendEmailService();
  } else {
    activeEmailService = new MailpitEmailService();
  }

  return activeEmailService;
}
