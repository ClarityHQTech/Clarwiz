import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { recomputeCompany } from "@/lib/assist/intelligence/compute.js";

/** POST: recompute the account/company briefing for one account. */
export async function POST(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.INSIGHT_RUN });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id } = params;

  try {
    const insight = await recomputeCompany(prisma, ctx.tenantId, id);
    return NextResponse.json({ ok: true, computed: !!insight });
  } catch (err) {
    console.error(`[MOFU] account recompute failed (${id}): ${err.message}`);
    return NextResponse.json({ ok: false, error: "Recompute failed" }, { status: 500 });
  }
}
