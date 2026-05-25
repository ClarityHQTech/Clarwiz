import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import { linkupCheckpoint } from "@/lib/linkupApi";
import {
  decryptLinkupAccountId,
  markLinkedInConnected,
  serializeLinkedInIntegration,
} from "@/lib/linkedinIntegration";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await prisma.linkedInIntegration.findUnique({
    where: { userId: user.id },
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
  const record = await markLinkedInConnected(user.id, accountId);

  return NextResponse.json({
    integration: serializeLinkedInIntegration(record),
  });
}
