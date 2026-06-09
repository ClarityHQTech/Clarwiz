import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { listWebhooksForTenant } from "@/lib/integrationWebhooks";
import {
  registerWebhookForProvider,
  registerWebhooksForTenant,
} from "@/lib/execution/registerIntegrationWebhooks";

export async function POST(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const provider = body.provider?.trim();
  const force = body.force === true;

  if (provider) {
    const result = await registerWebhookForProvider(ctx.tenantId, provider, {
      force,
      campaignId: body.campaignId,
    });
    const webhooks = await listWebhooksForTenant(ctx.tenantId);
    return NextResponse.json({ result, webhooks });
  }

  const results = await registerWebhooksForTenant(ctx.tenantId, {
    campaignId: body.campaignId,
  });
  const webhooks = await listWebhooksForTenant(ctx.tenantId);
  return NextResponse.json({ results, webhooks });
}
