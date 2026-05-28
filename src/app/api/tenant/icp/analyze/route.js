import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  runAccountSignalExtraction,
  runIcpAnalysisStep,
} from "@/lib/tenantIcpContext";

/** One GTM Core tool per request — can take up to ~10 min (Vercel hobby caps at 300s) */
export const maxDuration = Number(process.env.SERVERLESS_MAX_DURATION) || 300;
export const runtime = "nodejs";

export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ICP_CALL });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const mode = body.mode || "step";
  const step = body.step;

  try {
    let context;
    if (mode === "account_signals") {
      context = await runAccountSignalExtraction(ctx.tenantId);
    } else if (mode === "step") {
      if (!step || typeof step !== "string") {
        return NextResponse.json(
          { error: "step is required (e.g. market_research)" },
          { status: 400 }
        );
      }
      context = await runIcpAnalysisStep(ctx.tenantId, step);
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    return NextResponse.json({ context, step: step ?? null });
  } catch (err) {
    let status = 400;
    if (err.status === 429) status = 429;
    else if (err.code === "TIMEOUT") status = 504;
    else if (err.code === "UPSTREAM_FAILED") status = 502;
    else if (err.status >= 500) status = 502;

    return NextResponse.json(
      {
        error: err.message,
        code: err.code ?? null,
        retryable: Boolean(err.retryable),
        details: err.details ?? null,
      },
      { status }
    );
  }
}
