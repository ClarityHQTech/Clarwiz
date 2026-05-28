import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { buildDnsRecords, extractDomainFromEmail } from "@/lib/emailDnsRecords";

export async function GET(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const domain =
    request.nextUrl.searchParams.get("domain")?.trim().toLowerCase() ||
    extractDomainFromEmail(request.nextUrl.searchParams.get("email"));
  const trackingHost = request.nextUrl.searchParams.get("tracking")?.trim();

  if (!domain) {
    return NextResponse.json(
      { error: "domain or email query parameter is required" },
      { status: 400 }
    );
  }

  const dnsRecords = buildDnsRecords({
    sendingDomain: domain,
    trackingHost: trackingHost || undefined,
  });

  return NextResponse.json({ sendingDomain: domain, dnsRecords });
}
