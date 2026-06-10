/**
 * Send email via Gmail API (users.messages.send).
 */

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/** Encode a UTF-8 subject for RFC 2047 if non-ascii. */
function encodeSubject(subject) {
  if (!/[^\x00-\x7F]/.test(subject)) return subject;
  const b64 = Buffer.from(subject, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

/** Build a minimal RFC 2822 HTML message and return base64url for Gmail API. */
export function buildGmailRawMessage({ from, to, subject, html }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
  ];
  const raw = lines.join("\r\n");
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
  { from, to, subject, html },
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
        raw: buildGmailRawMessage({ from, to, subject, html }),
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
