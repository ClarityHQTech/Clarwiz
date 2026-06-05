import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  PROVIDER_PRESETS,
  serializeEmailIntegration,
  upsertSmartleadInbox,
} from "@/lib/emailIntegration";
import { buildDnsRecords, extractDomainFromEmail } from "@/lib/emailDnsRecords";
import {
  extractSmartleadAccountPayload,
  findEmailAccountByEmail,
  saveEmailAccount,
  updateEmailAccount,
} from "@/lib/smartleadApi";
import { registerWebhooksForTenant } from "@/lib/execution/registerIntegrationWebhooks";

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

  const fromEmail = body.fromEmail?.trim().toLowerCase();
  const fromName = body.fromName?.trim();
  const password = body.password;
  const providerType = body.providerType?.toUpperCase() || "GMAIL";
  const preset = PROVIDER_PRESETS[providerType] ?? PROVIDER_PRESETS.SMTP;

  if (!fromEmail || !password || !fromName) {
    return NextResponse.json(
      { error: "From name, email, and password are required" },
      { status: 400 }
    );
  }

  const smtpHost = body.smtpHost?.trim() || preset.smtp_host;
  const imapHost = body.imapHost?.trim() || preset.imap_host;

  if (!smtpHost || !imapHost) {
    return NextResponse.json(
      { error: "SMTP and IMAP hosts are required for custom SMTP" },
      { status: 400 }
    );
  }

  const customTrackingDomain = body.customTrackingDomain?.trim() || null;
  const sendingDomain = extractDomainFromEmail(fromEmail);

  const payload = {
    from_name: fromName,
    from_email: fromEmail,
    user_name: fromEmail,
    password,
    smtp_host: smtpHost,
    smtp_port: Number(body.smtpPort) || preset.smtp_port,
    imap_host: imapHost,
    imap_port: Number(body.imapPort) || preset.imap_port,
    type: preset.type,
    warmup_enabled: body.warmupEnabled !== false,
    total_warmup_per_day: Number(body.totalWarmupPerDay) || 20,
    daily_rampup: Number(body.dailyRampup) || 2,
    max_email_per_day: Number(body.maxEmailPerDay) || 50,
    time_to_wait_in_mins: Number(body.timeToWaitInMins) || 5,
  };

  if (customTrackingDomain) {
    payload.custom_tracking_url = customTrackingDomain;
  }

  try {
    let result;
    try {
      result = await saveEmailAccount(payload);
    } catch (err) {
      return NextResponse.json(
        { error: err.message || "Failed to connect inbox via Smartlead" },
        { status: err.status === 401 ? 401 : 422 }
      );
    }

    if (result?.ok === false) {
      return NextResponse.json(
        { error: result.message || "Smartlead could not connect this inbox" },
        { status: 422 }
      );
    }

    let accountData = extractSmartleadAccountPayload(result);
    if (!accountData?.id) {
      accountData = await findEmailAccountByEmail(fromEmail);
    }

    const accountId = accountData?.id;

    if (customTrackingDomain && accountId) {
      try {
        await updateEmailAccount(accountId, {
          custom_tracking_url: customTrackingDomain,
        });
      } catch {
        // Non-fatal — inbox is still connected
      }
    }

    const savePayload = accountData ? { ...result, data: accountData } : result;

    const record = await upsertSmartleadInbox(ctx.tenantId, savePayload, {
      fromEmail,
      fromName,
      providerType: preset.type,
      customTrackingDomain,
      warmupEnabled: payload.warmup_enabled,
    });

    const dnsRecords = buildDnsRecords({
      sendingDomain,
      trackingHost: customTrackingDomain,
    });

    const warnings = [];
    if (accountData?.is_smtp_success === false) {
      warnings.push("SMTP connection failed — check credentials and host.");
    }
    if (accountData?.is_imap_success === false) {
      warnings.push("IMAP connection failed — replies and tracking may not work.");
    }
    if (!extractSmartleadAccountPayload(result) && accountData?.id) {
      warnings.push(
        "Inbox connected — account id was resolved from your Smartlead account list."
      );
    }

    registerWebhooksForTenant(ctx.tenantId).catch((err) =>
      console.warn("[smartlead/connect] webhook registration:", err.message)
    );

    return NextResponse.json({
      integration: serializeEmailIntegration(record, { dnsRecords }),
      message: result?.message || "Email account connected via Smartlead",
      warnings,
    });
  } catch (err) {
    console.error("[smartlead/connect]", err);
    return NextResponse.json(
      { error: err.message || "Failed to save email integration" },
      { status: 500 }
    );
  }
}
