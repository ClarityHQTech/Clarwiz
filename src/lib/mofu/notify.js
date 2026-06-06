// Team notification (Slack webhook, best-effort). Never blocks the caller — a
// missing webhook or a failed post is a non-fatal skip (US-12.1 non-functional).
export async function notifyTeam({ message, deepLink }, deps = {}) {
  const url = deps.webhookUrl ?? process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: true, id: null, skipped: true, reason: "no_slack_webhook" };
  try {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: deepLink ? `${message}\n${deepLink}` : message }),
    });
    return { ok: !!res.ok, id: null };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
