import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import {
  getTenantIcpContext,
  upsertTenantIcpInputs,
} from "@/lib/tenantIcpContext";

export async function GET() {
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

  const context = await getTenantIcpContext(user.id);
  return NextResponse.json({ context });
}

export async function PATCH(request) {
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const context = await upsertTenantIcpInputs(user.id, {
    companyName: body.companyName ?? body.company_name,
    companyDomain: body.companyDomain ?? body.company_domain,
    relevantData: body.relevantData ?? body.relevant_data,
    userQuery: body.userQuery ?? body.user_query,
    accountData: body.accountData ?? body.account_data,
  });

  return NextResponse.json({ context });
}
