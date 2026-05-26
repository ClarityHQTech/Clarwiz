import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import {
  connectMetaWhatsApp,
  serializeWhatsAppIntegration,
} from "@/lib/whatsappIntegration";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const record = await connectMetaWhatsApp(user.id, {
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
