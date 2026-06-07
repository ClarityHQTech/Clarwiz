import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openaiClient";
import { logAssistAction } from "@/lib/assist/logAction";

const DRAFT_MODEL = process.env.NBA_DRAFT_MODEL || "gpt-4o-mini";

/**
 * Build the prompt for the email draft from an NBA's email_detail block.
 * Pure so it is easy to reason about; the LLM call itself is injectable.
 */
function buildDraftMessages(nba) {
  const detail = nba?.payload?.resource_requirements?.email_detail ?? {};
  const theme = typeof detail.theme === "string" ? detail.theme : "";
  const bullets = Array.isArray(detail.content)
    ? detail.content.filter((c) => typeof c === "string" && c.trim())
    : [];

  const context = [
    `NBA title: ${nba?.title ?? "(untitled)"}`,
    nba?.rationale ? `Why: ${nba.rationale}` : null,
    theme ? `Email theme: ${theme}` : null,
    bullets.length ? `Key points to cover:\n- ${bullets.join("\n- ")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      role: "system",
      content:
        "You are an expert B2B account executive writing concise, warm, professional sales follow-up emails. " +
        "Return STRICT JSON only, no prose, no markdown fences, shaped exactly as " +
        '{"subject": string, "emailHtml": string}. ' +
        "emailHtml must be clean inline HTML (<p>, <ul>, <li>, <strong> only — no <html>/<head>/<style>). " +
        "Keep it under ~180 words, one clear call to action, no placeholders like [Name] left unfilled — " +
        "use a neutral greeting if the recipient is unknown.",
    },
    {
      role: "user",
      content: `Draft the email based on this next-best-action:\n\n${context}`,
    },
  ];
}

function parseDraft(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) return null;
  let text = rawText.trim();
  // tolerate accidental ```json fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    const obj = JSON.parse(text);
    const subject = typeof obj.subject === "string" ? obj.subject : null;
    const emailHtml = typeof obj.emailHtml === "string" ? obj.emailHtml : null;
    if (!subject || !emailHtml) return null;
    return { subject, emailHtml };
  } catch {
    return null;
  }
}

/**
 * POST — execute an NBA: draft an email (HTML) from the NBA's email_detail,
 * persist it on draftPayload, mark the NBA EXECUTED, and log the action.
 *
 * `_openAIClientFactory` is injectable for tests; defaults to the shared client.
 */
export async function POST(request, { params }, { _openAIClientFactory = getOpenAIClient } = {}) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.NBA_EXECUTE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId, nbaId } = await params;

  const nba = await prisma.nbaRecommendation.findFirst({
    where: { id: nbaId, dealId, tenantId: ctx.tenantId },
    include: { deal: { select: { hubspotDealId: true } } },
  });
  if (!nba) {
    return NextResponse.json({ error: "nba_not_found" }, { status: 404 });
  }

  // Guard duplicate execution — return the existing draft idempotently.
  if (nba.status === "EXECUTED") {
    return NextResponse.json({ ok: true, alreadyExecuted: true, draft: nba.draftPayload ?? null });
  }

  // Draft via LLM, isolated so a provider failure never 500s the route.
  let draft;
  try {
    const client = _openAIClientFactory();
    const completion = await client.chat.completions.create({
      model: DRAFT_MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: buildDraftMessages(nba),
    });
    draft = parseDraft(completion?.choices?.[0]?.message?.content);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "draft_failed", reason: err?.message ?? "llm_error" },
      { status: 502 }
    );
  }

  if (!draft) {
    return NextResponse.json({ ok: false, error: "draft_unparseable" }, { status: 502 });
  }

  const updated = await prisma.nbaRecommendation.update({
    where: { id: nba.id },
    data: { status: "EXECUTED", executedAt: new Date(), draftPayload: draft },
  });

  const hsObjectId = nba.deal?.hubspotDealId ?? null;
  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId,
    action: "NBA_EXECUTED",
    payload: { nbaId: nba.id, title: nba.title },
  });
  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId,
    action: "EMAIL_DRAFTED",
    payload: { nbaId: nba.id, subject: draft.subject },
  });

  return NextResponse.json({ ok: true, draft, status: updated.status });
}
