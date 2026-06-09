import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openaiClient";
import { getDealView } from "@/lib/assist/insightsReader";
import { logAssistAction } from "@/lib/assist/logAction";

const BRIEF_MODEL = process.env.OPENAI_MODEL_SIMPLE || "gpt-4o-mini";

/**
 * Assemble a compact context string from the deal view + the NBA. Pure-ish
 * (reads `getDealView` output) so the prompt builder is easy to reason about.
 */
function buildBriefMessages({ nba, view }) {
  const deal = view?.deal;
  const company = view?.company;
  const insight = view?.insight?.payload ?? {};
  const contacts = Array.isArray(view?.contacts) ? view.contacts : [];
  const signals = Array.isArray(view?.signals) ? view.signals : [];

  const attendees = contacts
    .map((c) => {
      const bu = c?.businessUser;
      const name = bu?.name || c?.email || "Unknown";
      const role = bu?.jobTitle ? ` (${bu.jobTitle})` : "";
      return `- ${name}${role}`;
    })
    .join("\n");

  const sigLines = signals
    .slice(0, 6)
    .map((s) => `- [${s.type ?? "signal"}] ${s.headline}${s.suggestedAngle ? ` → angle: ${s.suggestedAngle}` : ""}`)
    .join("\n");

  const context = [
    `Meeting purpose (NBA): ${nba?.title ?? "(untitled)"}`,
    nba?.rationale ? `Why now: ${nba.rationale}` : null,
    nba?.actionVerb ? `Action: ${nba.actionVerb}` : null,
    deal ? `Deal: ${deal.name ?? "—"} · stage: ${deal.stageLabel ?? "—"} · amount: ${deal.amount ?? "—"}` : null,
    company?.name ? `Company: ${company.name}` : null,
    attendees ? `Attendees:\n${attendees}` : "Attendees: (none on file)",
    insight?.account_level_briefing ? `Account briefing: ${insight.account_level_briefing}` : null,
    sigLines ? `Recent signals:\n${sigLines}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      role: "system",
      content:
        "You are a sharp B2B sales coach preparing an account executive for an upcoming meeting. " +
        "Write a concise PRE-MEETING BRIEF in clean markdown with these sections: " +
        "**Who's attending**, **Deal state**, **Goals for this meeting**, **Risks / objections to navigate**, " +
        "**3 talking points** (a numbered list), and **The one ask**. " +
        "Be specific and grounded in the context provided; do not invent facts. Keep it under ~250 words.",
    },
    {
      role: "user",
      content: `Prepare the brief from this context:\n\n${context}`,
    },
  ];
}

/**
 * POST — generate a PRE-MEETING BRIEF for an NBA and store it on
 * `nba.draftPayload.brief`. Returns { ok, brief }. 502-safe: a provider failure
 * returns a 502 body rather than crashing.
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

  const view = await getDealView(prisma, ctx.tenantId, dealId);
  if (!view) {
    return NextResponse.json({ error: "deal_not_found" }, { status: 404 });
  }

  let brief;
  try {
    const client = _openAIClientFactory();
    const completion = await client.chat.completions.create({
      model: BRIEF_MODEL,
      temperature: 0.4,
      messages: buildBriefMessages({ nba, view }),
    });
    brief = completion?.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "brief_failed", reason: err?.message ?? "llm_error" },
      { status: 502 }
    );
  }

  if (!brief) {
    return NextResponse.json({ ok: false, error: "brief_empty" }, { status: 502 });
  }

  const prev = nba.draftPayload && typeof nba.draftPayload === "object" ? nba.draftPayload : {};
  await prisma.nbaRecommendation.update({
    where: { id: nba.id },
    data: { draftPayload: { ...prev, brief, briefAt: new Date().toISOString() } },
  });

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId: nba.deal?.hubspotDealId ?? null,
    action: "NBA_EXECUTED",
    payload: { nbaId: nba.id, kind: "pre_meeting_brief" },
  });

  return NextResponse.json({ ok: true, brief });
}
