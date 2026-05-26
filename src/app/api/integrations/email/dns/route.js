import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import { buildDnsRecords, extractDomainFromEmail } from "@/lib/emailDnsRecords";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
