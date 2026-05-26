import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import {
  getDecryptedSmartleadAccountId,
  serializeEmailIntegration,
} from "@/lib/emailIntegration";
import { buildDnsRecords } from "@/lib/emailDnsRecords";
import { updateEmailAccount } from "@/lib/smartleadApi";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
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
    accountId = await getDecryptedSmartleadAccountId(user.id);
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
    where: { userId: user.id },
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
