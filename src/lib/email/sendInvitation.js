import nodemailer from "nodemailer";
import { getAppBaseUrl } from "@/lib/appUrl";

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export async function sendTenantInvitationEmail({
  toEmail,
  tenantName,
  token,
  invitedByName,
}) {
  const baseUrl = getAppBaseUrl();
  const acceptUrl = `${baseUrl}/invite/accept?token=${encodeURIComponent(token)}`;
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();

  const subject = `You've been invited to ${tenantName} on ClarWiz`;
  const text = `${invitedByName || "A team admin"} invited you to collaborate on ${tenantName} in ClarWiz.\n\nAccept your invitation: ${acceptUrl}\n\nThis link expires in 7 days.`;
  const html = `<p>${invitedByName || "A team admin"} invited you to collaborate on <strong>${tenantName}</strong> in ClarWiz.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`;

  const transport = getTransport();
  if (!transport) {
    console.warn("[invite] SMTP not configured; invitation URL:", acceptUrl);
    return { sent: false, acceptUrl };
  }

  await transport.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html,
  });

  return { sent: true, acceptUrl };
}
