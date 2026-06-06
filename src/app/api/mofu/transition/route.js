import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { transitionToOpportunity } from "@/lib/mofu/transition";

// POST /api/mofu/transition — manual prospect -> opportunity promotion (US-12.1).
export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.NBA_RUN });
  if (auth.error) return auth.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const out = await transitionToOpportunity({
    tenantId: auth.ctx.tenantId,
    source: "MANUAL",
    company: body.company ?? {},
    contact: body.contact ?? {},
    dealName: body.dealName ?? null,
    stage: body.stage ?? null,
    amount: body.amount ?? null,
    clarwizContactId: body.clarwizContactId ?? null,
    deepLink: body.deepLink ?? null,
  });
  if (!out.ok && out.reason === "sor_not_connected") {
    return NextResponse.json({ ...out, cta: "connect_hubspot" }, { status: 409 });
  }
  if (!out.ok) return NextResponse.json(out, { status: 502 });
  return NextResponse.json(out, { status: 201 });
}
