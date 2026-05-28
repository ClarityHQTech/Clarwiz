import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/authContext";
import { requireAuth } from "@/lib/requireAuth";
import { acceptInvitation } from "@/lib/invitations";

export async function POST(request) {
  const ctx = await getAuthContext();
  const authErr = requireAuth(ctx);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  try {
    const result = await acceptInvitation({
      token,
      userEmail: ctx.user.email,
      userId: ctx.user.id,
    });
    return NextResponse.json({
      success: true,
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
      role: result.membership.role,
      scopes: result.membership.scopes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to accept invitation" },
      { status: 400 }
    );
  }
}
