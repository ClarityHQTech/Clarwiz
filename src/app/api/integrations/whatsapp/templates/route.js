import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getWhatsAppIntegration,
  refreshTemplatesCache,
  serializeWhatsAppIntegration,
} from "@/lib/whatsappIntegration";

export async function GET(request) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CHANNEL_INTEGRATE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  const record = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId: ctx.tenantId },
  });

  if (!record) {
    return NextResponse.json({ error: "WhatsApp is not connected" }, { status: 404 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") !== "false";

  try {
    if (refresh) {
      const updated = await refreshTemplatesCache(record);
      return NextResponse.json({
        templates: serializeWhatsAppIntegration(updated).templates,
        templatesCachedAt: updated.templatesCachedAt?.toISOString() ?? null,
      });
    }

    const integration = await getWhatsAppIntegration(ctx.tenantId);
    return NextResponse.json({
      templates: integration?.templates ?? [],
      templatesCachedAt: integration?.templatesCachedAt ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to load templates" },
      { status: 400 }
    );
  }
}
