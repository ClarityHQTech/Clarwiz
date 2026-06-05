import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  bootstrapWebhookSecretsFromEnv,
  listWebhooksForTenant,
} from "@/lib/integrationWebhooks";

export async function GET() {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  await bootstrapWebhookSecretsFromEnv(ctx.tenantId);
  const webhooks = await listWebhooksForTenant(ctx.tenantId);

  return NextResponse.json({ webhooks });
}
