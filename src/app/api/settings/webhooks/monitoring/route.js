import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { listWebhooksForTenant } from "@/lib/integrationWebhooks";
import { setWebhookMonitoring } from "@/lib/execution/registerIntegrationWebhooks";

export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const provider = body.provider?.trim();
  const action = body.action?.trim();

  if (!provider || !action) {
    return NextResponse.json(
      { error: "provider and action are required" },
      { status: 400 }
    );
  }

  const result = await setWebhookMonitoring(ctx.tenantId, provider, action);
  const webhooks = await listWebhooksForTenant(ctx.tenantId);

  return NextResponse.json({ result, webhooks });
}
