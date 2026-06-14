/**
 * Send email via Gmail API (users.messages.send).
 */

import { foldBase64 } from "@/lib/assist/ensureRenderableHtml";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/** Encode a UTF-8 subject for RFC 2047 if non-ascii. */
function encodeSubject(subject) {
  if (!/[^\x00-\x7F]/.test(subject)) return subject;
  const b64 = Buffer.from(subject, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

/**
 * Build a minimal RFC 2822 message and return base64url for Gmail API.
 * MIME-Version / Content-Type must live in the message headers (before the blank
 * line), not in the body — otherwise clients show raw multipart text.
 */
export function buildGmailRawMessage({ from, to, subject, html, attachments = [] }) {
  const att = Array.isArray(attachments) ? attachments.filter((a) => a?.content) : [];
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
  ];

  let body;

  if (!att.length) {
    headers.push("Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: 7bit");
    body = html;
  } else {
    const boundary = `clarwiz_${Date.now().toString(36)}`;
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const parts = [
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      html,
    ];
    for (const file of att) {
      const filename = String(file.filename || "attachment.html").replace(/"/g, "");
      const isPdf =
        (file.mimeType || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(filename);
      const isHtml =
        !isPdf &&
        ((file.mimeType || "").toLowerCase().includes("html") || /\.html?$/i.test(filename));
      const mimeType = isPdf
        ? "application/pdf"
        : isHtml
          ? "text/html"
          : file.mimeType || "application/octet-stream";
      const usePreEncoded = file.encoding === "base64" || isPdf;
      const b64 = usePreEncoded
        ? foldBase64(String(file.content).replace(/\s/g, ""))
        : foldBase64(Buffer.from(String(file.content), "utf8").toString("base64"));
      const charsetPart = isPdf ? "" : '; charset="UTF-8"';
      parts.push(
        `--${boundary}`,
        `Content-Type: ${mimeType}${charsetPart}; name="${filename}"`,
        `Content-Disposition: attachment; filename="${filename}"`,
        "Content-Transfer-Encoding: base64",
        "",
        b64
      );
    }
    parts.push(`--${boundary}--`);
    body = parts.join("\r\n");
  }

  const raw = `${headers.join("\r\n")}\r\n\r\n${body}`;
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Send one HTML email from the authenticated Gmail user. Never throws.
 * @returns {Promise<{ ok:boolean, id?:string, status?:number, reason?:string }>}
 */
export async function sendGmailMessage(
  accessToken,
  { from, to, subject, html, attachments },
  { fetchImpl = fetch } = {}
) {
  if (!accessToken || !from || !to || !subject || !html) {
    return { ok: false, reason: "missing_fields" };
  }
  try {
    const res = await fetchImpl(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: buildGmailRawMessage({ from, to, subject, html, attachments }),
      }),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (!res.ok) {
      if (res.status === 403) return { ok: false, reason: "gmail_forbidden", status: 403 };
      return { ok: false, reason: "gmail_send_failed", status: res.status, message: json?.error?.message };
    }
    return { ok: true, id: json?.id ?? null };
  } catch (err) {
    return { ok: false, reason: "network_error", message: err.message };
  }
}
