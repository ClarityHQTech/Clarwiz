import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { recomputeDeal } from "@/lib/assist/intelligence/compute.js";

/** POST: recompute signals + NBAs + deal insight for one deal. */
export async function POST(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.INSIGHT_RUN });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const { id } = params;

  try {
    const summary = await recomputeDeal(prisma, ctx.tenantId, id);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error(`[MOFU] deal recompute failed (${id}): ${err.message}`);
    return NextResponse.json({ ok: false, error: "Recompute failed" }, { status: 500 });
  }
}
