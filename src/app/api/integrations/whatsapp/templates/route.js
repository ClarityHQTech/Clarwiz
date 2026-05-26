import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import { prisma } from "@/lib/prisma";
import {
  getWhatsAppIntegration,
  refreshTemplatesCache,
  serializeWhatsAppIntegration,
} from "@/lib/whatsappIntegration";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await prisma.whatsAppIntegration.findUnique({
    where: { userId: user.id },
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

    const integration = await getWhatsAppIntegration(user.id);
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
