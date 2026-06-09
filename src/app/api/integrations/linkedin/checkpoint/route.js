import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { linkupCheckpoint } from "@/lib/linkupApi";
import {
  decryptLinkupAccountId,
  markLinkedInConnected,
  serializeLinkedInIntegration,
} from "@/lib/linkedinIntegration";
import { prisma } from "@/lib/prisma";
import { registerWebhooksForTenant } from "@/lib/execution/registerIntegrationWebhooks";

export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const integration = await prisma.linkedInIntegration.findUnique({
    where: { tenantId: ctx.tenantId },
  });

  if (!integration) {
    return NextResponse.json(
      { error: "No LinkedIn connection in progress" },
      { status: 404 }
    );
  }

  if (integration.status !== "checkpoint_required") {
    return NextResponse.json(
      { error: "Checkpoint verification is not required" },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const code = body.code?.trim();
  const isAppChallenge = integration.challengeType === "app_challenge";

  if (!isAppChallenge && !code) {
    return NextResponse.json(
      { error: "Verification code is required" },
      { status: 400 }
    );
  }

  let linkupAccountId;
  try {
    linkupAccountId = decryptLinkupAccountId(integration.linkupAccountId);
  } catch {
    return NextResponse.json(
      { error: "Could not read stored account credentials" },
      { status: 500 }
    );
  }

  let result;
  try {
    result = await linkupCheckpoint({
      accountId: linkupAccountId,
      code: isAppChallenge ? undefined : code,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to reach LinkupAPI" },
      { status: 500 }
    );
  }

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error?.message || "Verification failed",
        code: result.error?.code,
      },
      { status: 422 }
    );
  }

  const accountId = result.data?.account_id ?? linkupAccountId;
  const record = await markLinkedInConnected(ctx.tenantId, accountId);

  registerWebhooksForTenant(ctx.tenantId).catch((err) =>
    console.warn("[linkedin/checkpoint] webhook registration:", err.message)
  );

  return NextResponse.json({
    integration: serializeLinkedInIntegration(record),
  });
}
