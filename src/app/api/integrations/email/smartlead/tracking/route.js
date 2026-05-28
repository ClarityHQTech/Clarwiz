import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getDecryptedSmartleadAccountId,
  serializeEmailIntegration,
} from "@/lib/emailIntegration";
import { buildDnsRecords } from "@/lib/emailDnsRecords";
import { updateEmailAccount } from "@/lib/smartleadApi";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const record = await prisma.emailIntegration.findUnique({
    where: { tenantId: ctx.tenantId },
  });

  if (!record?.encryptedSmartleadAccountId) {
    return NextResponse.json(
      { error: "Connect a Smartlead inbox first" },
      { status: 404 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const customTrackingDomain = body.customTrackingDomain?.trim();
  if (!customTrackingDomain) {
    return NextResponse.json(
      { error: "customTrackingDomain is required (e.g. track.yourdomain.com)" },
      { status: 400 }
    );
  }

  let accountId;
  try {
    accountId = await getDecryptedSmartleadAccountId(ctx.tenantId);
  } catch {
    return NextResponse.json(
      { error: "Could not read stored Smartlead account" },
      { status: 500 }
    );
  }

  try {
    await updateEmailAccount(accountId, {
      custom_tracking_url: customTrackingDomain,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to update tracking domain in Smartlead" },
      { status: 422 }
    );
  }

  const updated = await prisma.emailIntegration.update({
    where: { tenantId: ctx.tenantId },
    data: { customTrackingDomain },
  });

  const dnsRecords = buildDnsRecords({
    sendingDomain: updated.sendingDomain,
    trackingHost: customTrackingDomain,
  });

  return NextResponse.json({
    integration: serializeEmailIntegration(updated, { dnsRecords }),
  });
}
