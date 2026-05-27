import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import {
  runAccountSignalExtraction,
  runIcpAnalysisStep,
} from "@/lib/tenantIcpContext";

/** One GTM Core tool per request — can take up to ~10 min (Vercel hobby caps at 300s) */
export const maxDuration = Number(process.env.SERVERLESS_MAX_DURATION) || 300;
export const runtime = "nodejs";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.payment) {
    return NextResponse.json(
      { error: "Forbidden", message: "You don't have access to this." },
      { status: 403 }
    );
  }

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
      context = await runAccountSignalExtraction(user.id);
    } else if (mode === "step") {
      if (!step || typeof step !== "string") {
        return NextResponse.json(
          { error: "step is required (e.g. market_research)" },
          { status: 400 }
        );
      }
      context = await runIcpAnalysisStep(user.id, step);
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
