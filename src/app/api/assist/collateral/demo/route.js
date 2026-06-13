import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getTenantBrand } from "@/lib/assist/collateralGen";
import { listDemoScenarios, getDemoScenario } from "@/lib/assist/richCollateral/demoContext";
import { getCollateralAssets } from "@/lib/assist/richCollateral/collateralAssets";
import {
  RICH_TEMPLATE_CATALOG,
  getRichTemplateMeta,
  renderRichTemplate,
} from "@/lib/assist/richCollateral/fillRichTemplate";
import { buildTenantProspectTokens } from "@/lib/assist/richCollateral/tenantTokens";
import {
  HYPER_PERSONALIZE_INSTRUCTION,
  personalizeRichHtml,
} from "@/lib/assist/richCollateral/personalizeRichHtml";
import { wrapCollateralPreviewHtml } from "@/lib/assist/richCollateral/previewBanner";
import { buildRichPersonalizationContext } from "@/lib/assist/richCollateral/buildPersonalizationContext";
import { logAssistAction } from "@/lib/assist/logAction";

const AUTH = { permission: PERMISSIONS.COLLATERAL_MANAGE, requirePaid: false };

/** GET — demo lab metadata (templates + scenarios). */
export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW, requirePaid: false });
  if (auth.error) return auth.error;

  const templates = Object.entries(RICH_TEMPLATE_CATALOG).map(([key, meta]) => ({
    key,
    title: meta.title,
    type: meta.type,
    category: meta.category,
  }));

  return NextResponse.json({
    templates,
    scenarios: listDemoScenarios(),
  });
}

/**
 * POST — generate demo collateral.
 * Body: { templateKey, scenarioId?, mode?: 'preview'|'ai'|'save', saveToLibrary?: boolean }
 */
export async function POST(request) {
  const auth = await resolveApiAuth(AUTH);
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const templateKey = typeof body?.templateKey === "string" ? body.templateKey.trim() : "";
  const meta = getRichTemplateMeta(templateKey);
  if (!meta) return NextResponse.json({ error: "invalid_template" }, { status: 400 });

  const scenario = getDemoScenario(body?.scenarioId);
  const mode = body?.mode === "ai" ? "ai" : body?.mode === "save" ? "save" : "preview";
  const saveToLibrary = Boolean(body?.saveToLibrary);

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { id: true, name: true, company_details: true },
  });
  const brand = getTenantBrand(tenant);
  const assets = getCollateralAssets(tenant?.company_details);
  const tokens = buildTenantProspectTokens({
    tenant,
    prospect: scenario.prospect,
    contact: scenario.contact,
    deal: scenario.deal,
    brand,
    assets,
  });

  let html = renderRichTemplate(templateKey, tokens);
  let source = "DEMO_FILL";

  if (mode === "ai") {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "anthropic_not_configured" }, { status: 412 });
    }
    try {
      const aiContext = {
        prospect: scenario.prospect,
        contacts: scenario.contact ? [scenario.contact] : [],
        deal: scenario.deal,
        brand,
        seller: { name: tenant?.name, company_details: tenant?.company_details },
      };
      html = await personalizeRichHtml({
        html,
        context: aiContext,
        instruction: HYPER_PERSONALIZE_INSTRUCTION,
      });
      source = "DEMO_AI_HYPER";
    } catch (err) {
      console.warn(`[MOFU] demo AI personalize failed: ${err.message}`);
      return NextResponse.json({ error: "ai_personalize_failed", reason: err.message }, { status: 502 });
    }
  }

  if (mode === "preview") {
    return NextResponse.json({
      ok: true,
      html: wrapCollateralPreviewHtml(html),
      isPreview: true,
      source,
      templateKey,
      scenarioId: scenario.id,
      title: `${meta.title} — ${tokens.prospect_company}`,
      personalizationContext: buildRichPersonalizationContext({
        seller: { name: tenant?.name, company_details: tenant?.company_details },
        prospect: scenario.prospect,
        contacts: scenario.contact ? [scenario.contact] : [],
        deal: scenario.deal,
        brand,
      }),
    });
  }

  const title = `${meta.title} — ${tokens.prospect_company}`;
  const document = await prisma.document.create({
    data: {
      tenantId: ctx.tenantId,
      title,
      html,
      template: JSON.stringify({ richTemplateKey: templateKey, scenarioId: scenario.id, tokens }),
      data: { richTemplateKey: templateKey, scenarioId: scenario.id, demo: true },
      promptVersion: source,
    },
  });

  let collateralId = null;
  if (saveToLibrary) {
    const row = await prisma.collateralIndex.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        type: meta.type,
        category: meta.category,
        source: "GENERATED",
        isTemplate: false,
        externalId: document.id,
        funnelStage: "ANY",
        tags: ["demo", "rich", templateKey],
      },
    });
    collateralId = row.id;
    await prisma.document
      .update({ where: { id: document.id }, data: { collateralId: row.id } })
      .catch(() => {});
  }

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "collateral",
    action: "COLLATERAL_SENT",
    payload: { documentId: document.id, source, demo: true, templateKey, scenarioId: scenario.id },
  });

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    collateralId,
    html,
    source,
    title,
  });
}
