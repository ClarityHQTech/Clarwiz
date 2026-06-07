import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDecryptedHubspotToken } from "@/lib/assist/mofuIntegration";
import { getDealPipelines } from "@/lib/assist/hubspot";
import { createDeal, associate, addNote } from "@/lib/assist/hubspotWrite";
import { firstOpenStageId } from "@/lib/assist/tofuTimeline";
import { logAssistAction } from "@/lib/assist/logAction";

/**
 * POST /api/assist/lead/[id]/promote — "Demo booked → Promote to Deal".
 *
 * Creates a HubSpot deal in the first open pipeline stage, associates the lead's
 * contact (and company, if known), drops a provenance note, mirrors a Deal row
 * into Clarwiz, and logs DEAL_CREATED. Association failures are non-fatal: the
 * deal is still created and we return a warning.
 *
 * 412 when HubSpot is not configured. 200 { ok:true, dealId } on success
 * (dealId = the Clarwiz Deal id). { ok:false, error } when the HubSpot deal
 * write itself fails.
 */
export async function POST(req, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.HUBSPOT_WRITE });
  if (auth.error) return auth.error;
  const { ctx } = auth;
  const tenantId = ctx.tenantId;
  const contactId = params.id;

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const dealname = typeof body.dealname === "string" ? body.dealname.trim() : "";
  const amount =
    body.amount === undefined || body.amount === null || body.amount === ""
      ? undefined
      : Number(body.amount);
  if (!dealname) {
    return NextResponse.json({ ok: false, error: "dealname is required" }, { status: 400 });
  }

  try {
    // Load the lead with its company so we can associate it.
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: { businessUser: { include: { company: true } } },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, error: "lead_not_found" }, { status: 404 });
    }

    const token = await getDecryptedHubspotToken(prisma, tenantId);
    if (!token) {
      return NextResponse.json({ ok: false, error: "mofu_not_configured" }, { status: 412 });
    }

    // Resolve the company's Clarwiz Account (for the FK link + HubSpot company id).
    const companyId = contact.businessUser?.companyId ?? null;
    const account = companyId
      ? await prisma.account.findFirst({ where: { tenantId, companyId } })
      : null;

    // First open pipeline stage for a brand-new deal.
    const stageId = firstOpenStageId(await getDealPipelines(token));

    const created = await createDeal(token, {
      name: dealname,
      stageId,
      amount,
      ownerId: account?.ownerId ?? null,
    });
    if (!created.ok || !created.id) {
      console.warn(`[MOFU] promote deal-create failed tenant=${tenantId} status=${created.status}`);
      return NextResponse.json({ ok: false, error: "hubspot_deal_create_failed" }, { status: 502 });
    }
    const hsDealId = created.id;

    // Associations are best-effort — a failure must not lose the created deal.
    let assocWarning = null;
    if (contact.hubspotContactId) {
      const r = await associate(token, hsDealId, "contacts", contact.hubspotContactId);
      if (!r.ok) assocWarning = "Deal created, but the contact association failed.";
    }
    if (account?.hubspotCompanyId) {
      const r = await associate(token, hsDealId, "companies", account.hubspotCompanyId);
      if (!r.ok) assocWarning = "Deal created, but the company association failed.";
    }

    await addNote(token, { dealId: hsDealId, body: "Created from Clarwiz MOFU — demo booked" });

    // Mirror a Clarwiz Deal row (early-band, open).
    const deal = await prisma.deal.create({
      data: {
        tenantId,
        accountId: account?.id ?? null,
        hubspotDealId: hsDealId,
        name: dealname,
        stageLabel: "New Deal",
        stageBand: "DEAL_EARLY",
        status: "OPEN",
        amount: amount ?? null,
        ownerId: account?.ownerId ?? null,
        lastActivityAt: new Date(),
      },
    });

    await logAssistAction(prisma, {
      tenantId,
      actorUserId: ctx.user?.id ?? null,
      entityType: "deal",
      hsObjectId: hsDealId,
      action: "DEAL_CREATED",
      payload: { contactId, dealId: deal.id, source: "lead_promote" },
    });

    console.info(`[MOFU] promote ok tenant=${tenantId} contact=${contactId} deal=${deal.id}`);
    return NextResponse.json({ ok: true, dealId: deal.id, ...(assocWarning ? { warning: assocWarning } : {}) });
  } catch (err) {
    console.error(`[MOFU] promote failed tenant=${tenantId} contact=${contactId}: ${err.message}`);
    return NextResponse.json({ ok: false, error: "promote_failed" }, { status: 500 });
  }
}
