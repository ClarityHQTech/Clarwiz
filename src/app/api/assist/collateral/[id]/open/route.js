import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAssistAction } from "@/lib/assist/logAction";

/**
 * GET — open a collateral item: 302-redirect to its viewer.
 *   - slug → HeyParrot-style viewer URL (composed; no live creds needed)
 *   - else url → straight redirect
 *   - else 404
 * Logs COLLATERAL_SENT on success.
 */
export async function GET(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id } = await params;

  const item = await prisma.collateralIndex.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let target = null;
  if (item.slug) {
    const origin = process.env.HEYPARROT_ORIGIN || "https://app.heyparrot.example";
    target = `${origin}/tailspin/collateral/${item.slug}?source=clarwiz`;
  } else if (item.url) {
    target = item.url;
  }

  if (!target) {
    return NextResponse.json({ error: "no_link" }, { status: 404 });
  }

  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "collateral",
    hsObjectId: item.companyHsId ?? item.dealHsId ?? null,
    action: "COLLATERAL_SENT",
    payload: { id: item.id, title: item.title, slug: item.slug, target },
  });

  return NextResponse.redirect(target, 302);
}
