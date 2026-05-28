import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  connectMetaWhatsApp,
  serializeWhatsAppIntegration,
} from "@/lib/whatsappIntegration";

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

  const accessToken = body.accessToken?.trim();
  const phoneNumberId = body.phoneNumberId?.trim();
  const wabaId = body.wabaId?.trim();

  if (!accessToken || !phoneNumberId || !wabaId) {
    return NextResponse.json(
      {
        error:
          "Access token, phone number ID, and WhatsApp Business Account ID are required",
      },
      { status: 400 }
    );
  }

  try {
    const record = await connectMetaWhatsApp(ctx.tenantId, {
      accessToken,
      phoneNumberId,
      wabaId,
    });

    return NextResponse.json({
      message: "WhatsApp connected via Meta Cloud API",
      integration: serializeWhatsAppIntegration(record),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to connect Meta WhatsApp" },
      { status: 400 }
    );
  }
}
