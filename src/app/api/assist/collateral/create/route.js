import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  assembleProspectContext,
  getTenantBrand,
  personalizeTemplate,
} from "@/lib/assist/collateralGen";
import { logAssistAction } from "@/lib/assist/logAction";
import { getCollateralAssets } from "@/lib/assist/richCollateral/collateralAssets";
import {
  getRichTemplateMeta,
  renderRichTemplate,
} from "@/lib/assist/richCollateral/fillRichTemplate";
import { contextToRichTokens } from "@/lib/assist/richCollateral/contextToTokens";
import {
  HYPER_PERSONALIZE_INSTRUCTION,
  personalizeRichHtml,
} from "@/lib/assist/richCollateral/personalizeRichHtml";
import { enrichCreatedCollaterals } from "@/lib/assist/enrichCreatedCollaterals";
import { resolveDocumentHtml } from "@/lib/assist/resolveDocumentHtml";

const AUTH = { permission: PERMISSIONS.COLLATERAL_MANAGE, requirePaid: false };
const OTHER_FALLBACK_RICH_KEY = "brochure";

/**
 * POST — create hyper-personalized collateral from user instructions.
 * Body: {
 *   templateId?: string,       // CollateralIndex id of a registered template
 *   customType?: string,       // when creating a new collateral type (Other)
 *   instructions: string,
 *   dealId?: string,
 *   prospectCompany?: string,
 *   ...
 * }
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

  const templateId = body?.templateId ? String(body.templateId) : null;
  const customType = typeof body?.customType === "string" ? body.customType.trim() : "";
  if (!templateId && !customType) {
    return NextResponse.json({ error: "template_or_custom_type_required" }, { status: 400 });
  }

  const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";
  if (!instructions) {
    return NextResponse.json({ error: "instructions_required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "anthropic_not_configured" }, { status: 412 });
  }

  let indexRow = null;
  let templateDoc = null;
  let richKey = null;
  let collateralType = "OTHER";
  let collateralCategory = null;
  let baseLabel = customType || "Collateral";

  if (templateId) {
    indexRow = await prisma.collateralIndex.findFirst({
      where: { id: templateId, tenantId: ctx.tenantId, isTemplate: true },
    });
    if (!indexRow) {
      return NextResponse.json({ error: "template_not_found" }, { status: 404 });
    }
    collateralType = indexRow.type;
    collateralCategory = indexRow.category;
    baseLabel = indexRow.title;

    if (indexRow.externalId) {
      templateDoc = await prisma.document.findFirst({
        where: { id: indexRow.externalId, tenantId: ctx.tenantId },
      });
      richKey = templateDoc?.data?.richTemplateKey ?? null;
    }
  } else {
    richKey = OTHER_FALLBACK_RICH_KEY;
    if (!getRichTemplateMeta(richKey)) {
      return NextResponse.json({ error: "fallback_template_missing" }, { status: 500 });
    }
  }

  const dealId = body?.dealId ? String(body.dealId) : null;
  let context;
  let dealHsId = null;
  let companyHsId = null;

  if (dealId) {
    context = await assembleProspectContext(prisma, ctx.tenantId, { dealId });
    dealHsId = context.dealHsId ?? null;
    companyHsId = context.companyHsId ?? null;
    context.creationBrief = { instructions, customType: customType || null };
  } else {
    const prospectCompany =
      typeof body?.prospectCompany === "string" ? body.prospectCompany.trim() : "";
    if (!prospectCompany) {
      return NextResponse.json({ error: "prospect_or_deal_required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { id: true, name: true, company_details: true },
    });
    const brand = getTenantBrand(tenant);

    context = {
      seller: { name: tenant?.name, company_details: tenant?.company_details },
      prospect: {
        name: prospectCompany,
        industry:
          typeof body?.prospectIndustry === "string" ? body.prospectIndustry.trim() : undefined,
      },
      contacts: [
        {
          name: typeof body?.championName === "string" ? body.championName.trim() : undefined,
          title: typeof body?.championTitle === "string" ? body.championTitle.trim() : undefined,
        },
      ].filter((c) => c.name || c.title),
      deal: {},
      brand,
      creationBrief: { instructions, customType: customType || null },
    };
  }

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { company_details: true },
  });
  const assets = getCollateralAssets(tenantRow?.company_details);
  const tokens = contextToRichTokens(context, assets);

  const personalizeInstruction = [
    HYPER_PERSONALIZE_INSTRUCTION,
    customType ? `REQUESTED COLLATERAL TYPE: ${customType}. Shape headings, structure, and copy for this format.` : "",
    "USER CREATION BRIEF (follow closely):",
    instructions,
  ]
    .filter(Boolean)
    .join("\n\n");

  let html;
  let promptVersion = "collateral-create-v1";
  let providerFields = {};
  let docData = {
    hyperPersonalized: true,
    creationInstructions: instructions,
    sourceTemplateId: templateId,
    customType: customType || null,
  };

  if (richKey) {
    html = renderRichTemplate(richKey, tokens);
    docData.richTemplateKey = richKey;
    try {
      const personalizedRes = await personalizeRichHtml({ html, context, instruction: personalizeInstruction });
      html = personalizedRes.html;
      providerFields = personalizedRes;
      promptVersion = customType ? "collateral-create-custom-v1" : "collateral-create-rich-v1";
    } catch (err) {
      console.warn(`[MOFU] collateral create personalize failed: ${err.message}`);
      return NextResponse.json({ error: "personalize_failed", reason: err.message }, { status: 502 });
    }
  } else if (templateDoc) {
    const baseHtml = resolveDocumentHtml(templateDoc);
    try {
      const personalized = await personalizeTemplate({
        templateDoc: {
          title: templateDoc.title,
          html: baseHtml,
          data: templateDoc.data,
        },
        context,
        instruction: personalizeInstruction,
      });
      html = personalized.html || baseHtml;
      providerFields = personalized;
      docData = { ...docData, ...(personalized.data && typeof personalized.data === "object" ? personalized.data : {}) };
      promptVersion = "collateral-create-template-v1";
    } catch (err) {
      console.warn(`[MOFU] collateral create template personalize failed: ${err.message}`);
      return NextResponse.json({ error: "personalize_failed", reason: err.message }, { status: 502 });
    }
  } else {
    return NextResponse.json({ error: "template_has_no_content" }, { status: 400 });
  }

  const title = `${baseLabel} — ${tokens.prospect_company}`;
  const tags = ["created"];
  if (templateId) tags.push(`from-template:${templateId}`);
  if (customType) tags.push(`custom-type:${customType.slice(0, 48)}`);
  if (richKey) tags.push(richKey);

  const document = await prisma.document.create({
    data: {
      tenantId: ctx.tenantId,
      dealHsId,
      companyHsId,
      title,
      html,
      template: JSON.stringify({
        sourceTemplateId: templateId,
        richTemplateKey: richKey,
        customType: customType || null,
        tokens,
        instructions,
        hyperPersonalized: true,
      }),
      data: docData,
      compliance: {
        score: "92",
        note: customType
          ? `Custom collateral (${customType}) — hyper-personalized from user brief`
          : "Created from registered template — hyper-personalized for tenant and prospect",
      },
      promptVersion,
    },
  });

  const collateral = await prisma.collateralIndex.create({
    data: {
      tenantId: ctx.tenantId,
      title,
      type: collateralType,
      category: collateralCategory,
      source: "GENERATED",
      isTemplate: false,
      externalId: document.id,
      dealHsId,
      companyHsId,
      funnelStage: "ANY",
      tags,
    },
  });

  await prisma.document
    .update({ where: { id: document.id }, data: { collateralId: collateral.id } })
    .catch(() => {});

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "collateral",
    hsObjectId: dealHsId || companyHsId || null,
    action: "COLLATERAL_SENT",
    payload: {
      documentId: document.id,
      collateralId: collateral.id,
      source: "COLLATERAL_CREATE",
      templateId,
      customType: customType || null,
    },
    modelUsed: providerFields.modelUsed ?? providerFields.model ?? null,
    providerUsage: providerFields.providerUsage ?? null,
    providerCost: providerFields.providerCost ?? null,
  });

  const [enriched] = await enrichCreatedCollaterals(prisma, ctx.tenantId, [
    {
      ...collateral,
      createdAt: collateral.createdAt,
      updatedAt: collateral.updatedAt,
      isTemplate: false,
    },
  ]);

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    collateralId: collateral.id,
    title,
    item: enriched,
  });
}
