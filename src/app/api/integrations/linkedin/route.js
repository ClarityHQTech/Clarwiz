import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import { getLinkedInIntegration } from "@/lib/linkedinIntegration";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await getLinkedInIntegration(user.id);
  return NextResponse.json({ integration });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.linkedInIntegration.deleteMany({
    where: { userId: user.id },
  });

  return NextResponse.json({ success: true });
}
