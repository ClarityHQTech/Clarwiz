import { NextResponse } from "next/server";
import { runScheduledOutreachForProspect } from "@/lib/execution/runCampaignExecution";
import { isCronRequestAuthorized } from "@/lib/cronAuth";

/** One contact per invocation — scales horizontally on Vercel. */
export const maxDuration =
  Number(process.env.SERVERLESS_MAX_DURATION) || 300;

export async function POST(request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { campaignId, campaignContactId } = body ?? {};
  if (!campaignId || !campaignContactId) {
    return NextResponse.json(
      { error: "campaignId and campaignContactId are required" },
      { status: 400 }
    );
  }

  try {
    const result = await runScheduledOutreachForProspect(
      campaignId,
      campaignContactId,
      { claimed: true }
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[outreach/worker]", campaignContactId, err);
    return NextResponse.json(
      { error: err.message || "Worker failed" },
      { status: 500 }
    );
  }
}
