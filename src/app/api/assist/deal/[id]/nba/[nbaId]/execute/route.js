import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient, ANTHROPIC_MODEL_SIMPLE } from "@/lib/anthropicClient";
import { runJsonPrompt } from "@/lib/assist/intelligence/runner";
import { logAssistAction } from "@/lib/assist/logAction";
import { mergeAssistProviderFields, providerFieldsFromTokens } from "@/lib/assist/providerMetadata";
import {
  assembleCollateralVars,
  assembleProspectContext,
  personalizeTemplate,
  generateCollateral,
  storeGeneratedCollateral,
} from "@/lib/assist/collateralGen";
import { rankCollateral } from "@/lib/assist/collateralRank";
import {
  buildAssistTenantIcpContext,
  getTenantIcpContextForExecution,
} from "@/lib/tenantIcpContext";
import {
  buildAssistBookingContext,
  getMofuIntegration,
} from "@/lib/assist/mofuIntegration";
import { appendAssistBookingLink } from "@/lib/assist/appendNbaBookingLink";
import { getCollateralAssets } from "@/lib/assist/richCollateral/collateralAssets";
import { renderRichTemplate } from "@/lib/assist/richCollateral/fillRichTemplate";
import { contextToRichTokens } from "@/lib/assist/richCollateral/contextToTokens";
import {
  HYPER_PERSONALIZE_INSTRUCTION,
  personalizeRichHtml,
} from "@/lib/assist/richCollateral/personalizeRichHtml";
import { isTemplateActiveForTenant } from "@/lib/assist/richCollateral/predefinedTemplates";

const DRAFT_MODEL = process.env.NBA_DRAFT_MODEL?.trim() || ANTHROPIC_MODEL_SIMPLE;

/**
 * Keyword → CollateralType map. An NBA only "needs a document" when its asset /
 * action genuinely calls for a product doc, sales pitch, one-pager, battlecard,
 * case study, or ROI doc. A scheduling / intro / follow-up email needs NONE —
 * those must NOT attach a doc (e.g. the screenshot's "Schedule health check").
 */
const ASSET_KEYWORDS = [
  [/\b(battle\s*card|battlecard|competitive|competitor|vs\b)/i, "BATTLECARD"],
  [/\b(case\s*study|success\s*story|customer\s*story)/i, "CASE_STUDY"],
  [/\b(roi|return\s+on\s+investment|payback|business\s+case|tco|cost\s+savings?)/i, "ROI_DOC"],
  [/\b(one[-\s]?pager|1[-\s]?pager|datasheet|data\s*sheet)/i, "ONE_PAGER"],
  [/\b(pitch\s*deck|sales\s*deck|deck|presentation)/i, "PITCH_DECK"],
  [/\b(product\s+(doc|sheet|brief|overview)|spec\s*sheet|capabilit(y|ies)\s+(doc|overview))/i, "ONE_PAGER"],
  [/\b(sales\s+pitch|pitch|collateral|brochure|white\s*paper|whitepaper|solution\s+brief)/i, "ONE_PAGER"],
];

/**
 * Phrases that, even if "asset"-shaped, are scheduling/intro/follow-up emails —
 * these never need a document.
 */
const NO_DOC_RE = /^(none|n\/a|no|not\s+required|email|follow[-\s]?up|intro(duction)?|schedule|check[-\s]?in|reminder|thank\s*you|nudge)\b/i;

/**
 * Resolve what document (if any) the NBA needs. Returns
 * `{ description, type, category }` when a genuine document is called for, else
 * null. `type` is a CollateralType (or "ROI_DOC" sentinel) used for ranking;
 * `category` is MARKETING|SALES.
 */
function neededAsset(nba) {
  const p = nba?.payload || {};
  const candidates = [p.asset, p?.resource_requirements?.asset, nba?.title];
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (!t) continue;
    if (NO_DOC_RE.test(t)) continue;
    for (const [re, type] of ASSET_KEYWORDS) {
      if (re.test(t)) {
        // Map the ROI_DOC sentinel to a real CollateralType for ranking.
        // Every doc the NBA can call for here is SALES-side collateral.
        const rankType = type === "ROI_DOC" ? "CASE_STUDY" : type;
        return { description: t, type: rankType, category: "SALES" };
      }
    }
  }
  return null;
}

/**
 * Map a deal's stageBand (or a free-text stage label) to a FunnelStage for
 * template ranking. Defaults to "ANY".
 */
function stageToFunnel(stageBand, stageLabel) {
  if (stageBand === "LEAD" || stageBand === "DEAL_EARLY" || stageBand === "DEAL_LATE") {
    return stageBand;
  }
  const s = typeof stageLabel === "string" ? stageLabel.toLowerCase() : "";
  if (/\b(lead|prospect|qualif)/.test(s)) return "LEAD";
  if (/\b(discovery|demo|early|interest)/.test(s)) return "DEAL_EARLY";
  if (/\b(proposal|negotiat|contract|closing|decision|late)/.test(s)) return "DEAL_LATE";
  return "ANY";
}

/**
 * Persist a personalized template instance: a non-template Document (instance)
 * + a CollateralIndex(instance) row, linked. Mirrors storeGeneratedCollateral
 * but keeps the template's type/category and marks the instance source.
 */
async function storePersonalizedInstance(
  prisma,
  { tenantId, personalized, type, category = null, dealHsId = null, companyHsId = null }
) {
  const finalTitle =
    (personalized.title && personalized.title.trim()) || "Personalized collateral";

  const document = await prisma.document.create({
    data: {
      tenantId,
      dealHsId,
      companyHsId,
      title: finalTitle,
      template: personalized.template || "",
      html: personalized.html || "",
      data: personalized.data ?? {},
      compliance: personalized.compliance ?? null,
      model: personalized.model,
      promptVersion: personalized.promptVersion,
    },
  });

  const collateral = await prisma.collateralIndex.create({
    data: {
      tenantId,
      title: finalTitle,
      type: type || "ONE_PAGER",
      category,
      source: "GENERATED",
      isTemplate: false,
      externalId: document.id,
      companyHsId,
      dealHsId,
    },
  });

  await prisma.document
    .update({ where: { id: document.id }, data: { collateralId: collateral.id } })
    .catch(() => {});

  return { document, collateral };
}

/**
 * Build the prompt for the email draft from an NBA's email_detail block.
 * Pure so it is easy to reason about; the LLM call itself is injectable.
 */
export function buildDraftMessages(
  nba,
  { postMeeting = false, icpContext = null, bookingContext = null } = {}
) {
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
    icpContext ? `Tenant ICP context (align tone, value prop, and positioning):\n${JSON.stringify(icpContext, null, 2)}` : null,
    bookingContext?.bookingLinkConfigured
      ? `Scheduling: a tracked Calendly booking link will be appended automatically — invite the recipient to schedule if a meeting would help. Do not paste raw Calendly URLs.`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const framing = postMeeting
    ? "This is a POST-MEETING FOLLOW-UP email: thank the recipient for their time, briefly recap what was " +
      "discussed and agreed, confirm the next steps and owners, and end with one clear call to action. "
    : "";

  const icpRule = icpContext
    ? "When tenant ICP context is provided, align messaging with the ICP workbook, value proposition, and persona definitions — same as the TOFU execution layer. "
    : "";
  const bookingRule = bookingContext?.bookingLinkConfigured
    ? "When scheduling is configured, include a warm invitation to book a meeting; the app appends the tracked booking link after generation. Never paste raw Calendly URLs. "
    : "";

  return [
    {
      role: "system",
      content:
        "You are an expert B2B account executive writing concise, warm, professional sales follow-up emails. " +
        framing +
        icpRule +
        bookingRule +
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
 * `_anthropicClientFactory` is injectable for tests; defaults to the shared client.
 */
export async function POST(request, { params }, { _anthropicClientFactory = getAnthropicClient } = {}) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.NBA_EXECUTE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id: dealId, nbaId } = await params;

  // Optional body — `{ postMeeting: true }` frames the draft as a post-meeting
  // follow-up recap. Tolerate an absent/empty body (the existing callers send none).
  let reqBody = {};
  try {
    reqBody = (await request.json()) ?? {};
  } catch {
    reqBody = {};
  }
  const postMeeting = reqBody?.postMeeting === true;

  const nba = await prisma.nbaRecommendation.findFirst({
    where: { id: nbaId, dealId, tenantId: ctx.tenantId },
    include: { deal: { select: { hubspotDealId: true } } },
  });
  if (!nba) {
    return NextResponse.json({ error: "nba_not_found" }, { status: 404 });
  }

  // Guard duplicate execution — return the existing draft idempotently. A
  // post-meeting follow-up explicitly re-drafts (the meeting changed the context),
  // so it skips this guard.
  if (nba.status === "EXECUTED" && !postMeeting) {
    return NextResponse.json({ ok: true, alreadyExecuted: true, draft: nba.draftPayload ?? null });
  }

  const [tenantIcp, mofu] = await Promise.all([
    getTenantIcpContextForExecution(ctx.tenantId).catch(() => null),
    getMofuIntegration(prisma, ctx.tenantId),
  ]);
  const icpContext = buildAssistTenantIcpContext(tenantIcp);
  const bookingContext = buildAssistBookingContext(mofu);

  // Draft via LLM, isolated so a provider failure never 500s the route.
  let draft;
  const usageCalls = [];
  try {
    const client = _anthropicClientFactory();
    const messages = buildDraftMessages(nba, { postMeeting, icpContext, bookingContext });
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    const { data, tokensUsed } = await runJsonPrompt({
      llm: client,
      model: DRAFT_MODEL,
      system,
      user,
      temperature: 0.5,
    });
    usageCalls.push(providerFieldsFromTokens(DRAFT_MODEL, tokensUsed));
    draft = data
      ? {
          subject: typeof data.subject === "string" ? data.subject : null,
          emailHtml: typeof data.emailHtml === "string" ? data.emailHtml : null,
        }
      : null;
    if (draft && (!draft.subject || !draft.emailHtml)) draft = parseDraft(JSON.stringify(data));
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "draft_failed", reason: err?.message ?? "llm_error" },
      { status: 502 }
    );
  }

  if (!draft) {
    return NextResponse.json({ ok: false, error: "draft_unparseable" }, { status: 502 });
  }

  if (bookingContext.bookingLinkConfigured) {
    draft.emailHtml = appendAssistBookingLink({
      html: draft.emailHtml,
      calendlyBookingUrl: bookingContext.calendlyBookingUrl,
      dealId,
      nbaId: nba.id,
    });
  }

  // (B) If this NBA genuinely needs a document, attach hyper-personalized
  // collateral: pick the best brand TEMPLATE from the directory and personalize
  // it to this prospect (preferred), else fall back to generate-from-scratch.
  // Fenced so any failure (no key, Claude error) still returns the email —
  // collateral is optional. On success we append a "View / edit asset" link.
  const draftPayload = { ...draft };
  const need = neededAsset(nba);
  let collateralProviderFields = {};
  if (need && process.env.ANTHROPIC_API_KEY) {
    try {
      const context = await assembleProspectContext(prisma, ctx.tenantId, { nbaId: nba.id });
      const dealHsId = context.dealHsId || nba.deal?.hubspotDealId || null;
      const companyHsId = context.companyHsId || null;

      const tenantRow = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { name: true, company_details: true },
      });
      const assets = getCollateralAssets(tenantRow?.company_details);

      // Load templates; exclude predefined templates removed from this workspace.
      const allTemplates = await prisma.collateralIndex.findMany({
        where: { tenantId: ctx.tenantId, isTemplate: true },
      });
      const templates = allTemplates.filter((t) =>
        isTemplateActiveForTenant(t, tenantRow?.company_details),
      );
      const funnelStage = stageToFunnel(nba.deal?.stageBand, context.deal?.stage);
      const ranked = rankCollateral(templates, {
        type: need.type,
        category: need.category,
        funnelStage,
        companyHsId,
        industry: context.prospect?.industry ?? null,
        persona: context.assetBrief?.audience ?? null,
      });
      const best = ranked[0] && ranked[0].score > 0 ? ranked[0] : null;

      let stored;
      let source;
      if (best?.externalId) {
        // PICK → PERSONALIZE: load the template Document, personalize, store an instance.
        const templateDoc = await prisma.document.findFirst({
          where: { id: best.externalId, tenantId: ctx.tenantId },
        });
        if (templateDoc) {
          const richKey = templateDoc.data?.richTemplateKey;
          let personalized;

          if (richKey) {
            const tokens = contextToRichTokens(context, assets);
            let html = renderRichTemplate(richKey, tokens);
            let hyperPersonalized = false;
            if (process.env.ANTHROPIC_API_KEY) {
              try {
                const personalizedRes = await personalizeRichHtml({
                  html,
                  context,
                  instruction: HYPER_PERSONALIZE_INSTRUCTION,
                });
                html = personalizedRes.html;
                collateralProviderFields = personalizedRes;
                hyperPersonalized = true;
              } catch (err) {
                console.warn(`[MOFU] rich HTML hyper-personalize failed: ${err.message}`);
              }
            }
            personalized = {
              title: `${templateDoc.title} — ${tokens.prospect_company}`,
              html,
              template: JSON.stringify({ richTemplateKey: richKey, tokens, hyperPersonalized }),
              data: { richTemplateKey: richKey, hyperPersonalized },
              compliance: {
                score: hyperPersonalized ? "92" : "75",
                note: hyperPersonalized
                  ? "Rich HTML — hyper-personalized copy for tenant and prospect"
                  : "Rich HTML — token fill only (AI personalization unavailable)",
              },
              promptVersion: hyperPersonalized ? "rich-html-hyper-v1" : "rich-html-fill-v1",
            };
          } else {
            personalized = await personalizeTemplate({
              templateDoc: {
                title: templateDoc.title,
                html: templateDoc.html,
                data: templateDoc.data,
              },
              context,
              instruction:
                "This collateral will be sent to the prospect. Remove any template scaffolding, " +
                "internal AE notes, and unsupported claims. Use only facts from context; omit anything unknown.",
            });
            collateralProviderFields = personalized;
          }

          stored = await storePersonalizedInstance(prisma, {
            tenantId: ctx.tenantId,
            personalized,
            type: best.type,
            category: best.category,
            dealHsId,
            companyHsId,
          });
          source = "PERSONALIZED";
        }
      }

      if (!stored) {
        // FALLBACK: no template fits — generate from scratch (brand + context).
        const { vars } = await assembleCollateralVars(prisma, ctx.tenantId, { nbaId: nba.id });
        const generated = await generateCollateral({ vars });
        collateralProviderFields = generated;
        const { document } = await storeGeneratedCollateral(prisma, {
          tenantId: ctx.tenantId,
          generated,
          title: generated.title,
          dealHsId,
          companyHsId,
        });
        stored = { document };
        source = "GENERATED";
      }

      const document = stored.document;
      draftPayload.documentId = document.id;
      draftPayload.collateralTitle = document.title;
      // Collateral is attached as a real .html file on send — no in-app viewer URLs.
      draftPayload.emailHtml = draft.emailHtml;

      await logAssistAction(prisma, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user?.id ?? null,
        entityType: "collateral",
        hsObjectId: nba.deal?.hubspotDealId ?? null,
        action: "COLLATERAL_SENT",
        payload: {
          nbaId: nba.id,
          documentId: document.id,
          source,
          templateId: source === "PERSONALIZED" ? best?.id ?? null : null,
          fromNba: true,
        },
        modelUsed: collateralProviderFields.modelUsed ?? collateralProviderFields.model ?? null,
        providerUsage: collateralProviderFields.providerUsage ?? null,
        providerCost: collateralProviderFields.providerCost ?? null,
      });
    } catch (err) {
      // Collateral is optional — never block the email on a generation failure.
      console.warn(`[MOFU] NBA collateral attach failed: ${err.message}`);
    }
  }

  const updated = await prisma.nbaRecommendation.update({
    where: { id: nba.id },
    data: { status: "EXECUTED", executedAt: new Date(), draftPayload },
  });

  const hsObjectId = nba.deal?.hubspotDealId ?? null;
  const draftProviderFields = mergeAssistProviderFields(usageCalls);
  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId,
    action: "NBA_EXECUTED",
    payload: { nbaId: nba.id, title: nba.title },
    ...draftProviderFields,
  });
  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "deal",
    hsObjectId,
    action: "EMAIL_DRAFTED",
    payload: { nbaId: nba.id, subject: draft.subject },
    ...draftProviderFields,
  });

  return NextResponse.json({ ok: true, draft: draftPayload, status: updated.status });
}
