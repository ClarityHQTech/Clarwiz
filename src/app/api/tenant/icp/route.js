import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getTenantIcpContext,
  upsertTenantIcpInputs,
} from "@/lib/tenantIcpContext";

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ICP_CALL });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const context = await getTenantIcpContext(ctx.tenantId);
  return NextResponse.json({ context });
}

export async function PATCH(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ICP_CALL });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const context = await upsertTenantIcpInputs(ctx.tenantId, {
    companyName: body.companyName ?? body.company_name,
    companyDomain: body.companyDomain ?? body.company_domain,
    relevantData: body.relevantData ?? body.relevant_data,
    userQuery: body.userQuery ?? body.user_query,
    accountData: body.accountData ?? body.account_data,
  });

  return NextResponse.json({ context });
}
