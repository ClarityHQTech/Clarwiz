import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import { prisma } from "@/lib/prisma";
import { getWhatsAppIntegration } from "@/lib/whatsappIntegration";

export async function GET(request) {
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

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const integration = await getWhatsAppIntegration(user.id, { refresh });

  return NextResponse.json({ integration });
}

export async function DELETE() {
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

  await prisma.whatsAppIntegration.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ success: true });
}
