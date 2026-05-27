import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authSession";
import { linkupLogin } from "@/lib/linkupApi";
import {
  serializeLinkedInIntegration,
  upsertLinkedInFromLogin,
} from "@/lib/linkedinIntegration";

const COUNTRIES = ["US", "UK", "FR", "DE", "NL", "IT", "IL", "CA", "BR", "ES", "IN"];

export async function POST(request) {
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  const country = body.country?.toUpperCase() || "US";
  const accountName = body.accountName?.trim();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (!COUNTRIES.includes(country)) {
    return NextResponse.json({ error: "Invalid country code" }, { status: 400 });
  }

  let result;
  try {
    result = await linkupLogin({ email, password, country, accountName });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to reach LinkupAPI" },
      { status: 500 }
    );
  }

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error?.message || "LinkedIn login failed",
        code: result.error?.code,
      },
      { status: 422 }
    );
  }

  const record = await upsertLinkedInFromLogin(user.id, result, {
    email,
    accountName,
    country,
  });

  return NextResponse.json({
    integration: serializeLinkedInIntegration(record),
    message: result.data?.message ?? null,
  });
}
