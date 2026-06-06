import crypto from "node:crypto";

// US-11.1 — Verify Slack's request signature (HMAC over v0:timestamp:body).
export function verifySlackSignature({ signingSecret, timestamp, rawBody, signature, nowMs = Date.now() }) {
  if (!signingSecret || !timestamp || !signature) return false;
  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false; // reject replays > 5 min
  const base = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + crypto.createHmac("sha256", signingSecret).update(base).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Parse an interactive payload's first action -> { actionId, value, teamId }. */
export function parseSlackAction(payload) {
  const action = payload?.actions?.[0];
  if (!action) return null;
  return { actionId: action.action_id, value: action.value, teamId: payload?.team?.id ?? null };
}

/** Parse `/clarwiz deal Acme` -> { command:"deal", arg:"Acme" }. */
export function parseSlashCommand(text = "") {
  const parts = String(text).trim().split(/\s+/);
  return { command: (parts[0] || "").toLowerCase(), arg: parts.slice(1).join(" ") };
}

/** Build a Slack message with ranked NBA cards + Approve buttons (gated). */
export function buildDealNbaResponse({ dealName, cards = [] }) {
  if (!cards.length) {
    return { response_type: "ephemeral", text: `No NBA for *${dealName}* yet. Run "suggest now" first.` };
  }
  const blocks = [{ type: "section", text: { type: "mrkdwn", text: `*NBA for ${dealName}*` } }];
  for (const c of cards.slice(0, 5)) {
    const section = {
      type: "section",
      text: { type: "mrkdwn", text: `*${c.title}*\n${c.actionType} · score ${Number(c.score).toFixed(2)}` },
    };
    if (c.gate?.executable) {
      section.accessory = {
        type: "button",
        text: { type: "plain_text", text: "Approve & send" },
        action_id: `approve_${c.id}`,
        value: c.id,
        style: "primary",
      };
    }
    blocks.push(section);
    if (!c.gate?.executable) {
      blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: c.gate?.cta ?? "Not executable" }] });
    }
  }
  return { response_type: "ephemeral", blocks };
}
