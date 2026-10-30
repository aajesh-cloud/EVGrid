/**
 * Outbound email delivery — Gmail SMTP through Nodemailer.
 *
 * Credentials come from `backend/.env` only (`SMTP_USER` / `SMTP_PASSWORD`) and
 * never leave this process. The transport is created lazily and reused.
 *
 * `isMailConfigured()` lets the auth controller choose between real delivery
 * and the development console fallback; see `deliverOtp` in
 * `controllers/authController.js`.
 */

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transport = null;

/** True when both SMTP_USER and SMTP_PASSWORD are present in backend/.env. */
export function isMailConfigured() {
  return env.smtp.configured;
}

function getTransport() {
  if (!isMailConfigured()) return null;

  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      // Port 587 upgrades to TLS with STARTTLS; require it so a downgrade
      // attempt fails instead of sending credentials in clear text.
      requireTLS: !env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.password },
      // Fail fast rather than hanging when the port is blocked by a firewall.
      connectionTimeout: env.smtp.connectionTimeoutMs,
      greetingTimeout: env.smtp.connectionTimeoutMs,
      socketTimeout: env.smtp.socketTimeoutMs,
      pool: false,
    });
  }

  return transport;
}

function formatFrom() {
  return env.smtp.fromName
    ? { name: env.smtp.fromName, address: env.smtp.from }
    : env.smtp.from;
}

/**
 * Confirms the SMTP credentials and connectivity. Used once at boot so a
 * misconfigured mailbox is reported immediately instead of on the first
 * registration. Resolves with the transport on success and rejects with the
 * Nodemailer error otherwise.
 */
export async function verifyMailer() {
  const tx = getTransport();
  if (!tx) throw new Error('SMTP is not configured (SMTP_USER / SMTP_PASSWORD are empty).');
  await tx.verify();
  return true;
}

/**
 * Sends one message. Any Nodemailer/SMTP failure is propagated unchanged so the
 * caller can attach the transport error code to the API error.
 */
export async function sendMail({ to, subject, text, html }) {
  const tx = getTransport();
  if (!tx) throw new Error('SMTP is not configured (SMTP_USER / SMTP_PASSWORD are empty).');

  const info = await tx.sendMail({
    from: formatFrom(),
    to,
    subject,
    text,
    html,
  });

  // With Gmail the message id looks like "<...@mail.gmail.com>".
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

/* ------------------------------------------------------------------ */
/* Templates                                                          */
/* ------------------------------------------------------------------ */

function otpEmailContent({ otp, ttlMinutes, fullName }) {
  const greeting = fullName ? `Hi ${fullName},` : 'Hi,';

  const text = [
    greeting,
    '',
    `Your EVGrid verification code is ${otp}.`,
    `It expires in ${ttlMinutes} minutes and can only be used once.`,
    '',
    "If you didn't create an EVGrid account, you can ignore this email.",
    '',
    '— EVGrid',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#0b0f17;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e6ebf2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#121826;border:1px solid #1f2937;border-radius:14px;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <div style="font-size:18px;font-weight:700;letter-spacing:.4px;color:#22d3a7;">EVGrid</div>
          <div style="font-size:13px;color:#8b98ab;margin-top:4px;">Electric vehicle charging network</div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 0;">
          <p style="font-size:14px;line-height:1.6;margin:12px 0 0;">${greeting}</p>
          <p style="font-size:14px;line-height:1.6;margin:8px 0 0;">Use the code below to verify your email address.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px;">
          <div style="background:#0b0f17;border:1px solid #1f2937;border-radius:10px;padding:18px;text-align:center;">
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;">${otp}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 24px;">
          <p style="font-size:13px;line-height:1.6;color:#8b98ab;margin:0;">This code expires in <strong style="color:#e6ebf2;">${ttlMinutes} minutes</strong> and can only be used once.</p>
          <p style="font-size:13px;line-height:1.6;color:#8b98ab;margin:12px 0 0;">If you didn't create an EVGrid account, you can safely ignore this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

/** Sends the email-verification code. Throws if delivery fails. */
export async function sendOtpEmail(to, { otp, ttlMinutes, fullName }) {
  const { text, html } = otpEmailContent({ otp, ttlMinutes, fullName });
  return sendMail({ to, subject: `${otp} is your EVGrid verification code`, text, html });
}
