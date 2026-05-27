import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import {
  disconnectCalendly,
  getCalendlyIntegration,
} from "@/lib/calendlyIntegration";

export async function GET() {
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

  const integration = await getCalendlyIntegration(user.id);
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

  try {
    await disconnectCalendly(user.id);
    return NextResponse.json({ integration: null });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to disconnect Calendly" },
      { status: 500 }
    );
  }
}
