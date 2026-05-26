const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function graphUrl(path, params = {}) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${GRAPH_BASE}${normalized}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function withToken(url, accessToken) {
  const u = new URL(url);
  u.searchParams.set("access_token", accessToken);
  return u.toString();
}

async function graphFetch(path, accessToken, { method = "GET", body } = {}) {
  const baseUrl = graphUrl(path);
  const url = withToken(baseUrl, accessToken);
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `Meta API error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/** Fetch display metadata for a Meta phone number ID. */
export async function getPhoneNumberDetails(phoneNumberId, accessToken) {
  return graphFetch(
    `/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    accessToken
  );
}

export async function validateMetaConnection({ accessToken, phoneNumberId, wabaId }) {
  const phone = await graphFetch(
    `/${phoneNumberId}?fields=display_phone_number,verified_name`,
    accessToken
  );
  await listMessageTemplates(wabaId, accessToken, { limit: 1 });
  return {
    businessPhone: phone.display_phone_number ?? null,
    businessName: phone.verified_name ?? null,
  };
}

/** List WABA message templates with pagination. */
export async function listMessageTemplates(wabaId, accessToken, { limit = 100 } = {}) {
  const templates = [];
  let url = withToken(
    graphUrl(`/${wabaId}/message_templates`, {
      limit,
      fields:
        "id,name,language,status,category,components,quality_score,rejected_reason",
    }),
    accessToken
  );

  while (url) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `Failed to fetch templates (${res.status})`);
    }
    const batch = data?.data ?? [];
    templates.push(...batch);
    url = data?.paging?.next ?? null;
  }

  return templates;
}

/** Normalize Meta template nodes for UI / campaigns. */
export function normalizeMetaTemplates(rawList) {
  return (rawList ?? []).map((t) => {
    const bodyComponent = t.components?.find((c) => c.type === "BODY");
    const headerComponent = t.components?.find((c) => c.type === "HEADER");
    const footerComponent = t.components?.find((c) => c.type === "FOOTER");
    const buttonsComponent = t.components?.find((c) => c.type === "BUTTONS");

    const bodyText = bodyComponent?.text ?? "";
    const bodyVariableCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;
    const headerText =
      headerComponent?.type === "TEXT" ? headerComponent?.text ?? "" : "";
    const headerVariableCount = (headerText.match(/\{\{\d+\}\}/g) ?? []).length;

    return {
      id: t.id ?? t.name,
      name: t.name,
      displayName: t.name,
      language: typeof t.language === "string" ? t.language : t.language?.code ?? "en",
      category: t.category ?? null,
      status: t.status ?? "UNKNOWN",
      body: bodyText,
      header: headerComponent?.text ?? headerComponent?.format ?? null,
      footer: footerComponent?.text ?? null,
      buttons: buttonsComponent?.buttons ?? null,
      components: t.components ?? [],
      variableCount: bodyVariableCount,
      bodyVariableCount,
      headerVariableCount,
      qualityScore: t.quality_score?.score ?? t.quality_score ?? null,
      source: "meta",
    };
  });
}

/** Send an approved template message via Cloud API. */
export async function sendTemplateMessage({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  languageCode,
  bodyParameters = [],
  headerParameters = [],
  callbackData,
}) {
  const components = [];

  if (headerParameters.length) {
    components.push({
      type: "header",
      parameters: headerParameters.map((text) => ({
        type: "text",
        text: String(text),
      })),
    });
  }

  if (bodyParameters.length) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((text) => ({
        type: "text",
        text: String(text),
      })),
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: to.replace(/\D/g, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length ? { components } : {}),
    },
    ...(callbackData ? { biz_opaque_callback_data: String(callbackData) } : {}),
  };

  return graphFetch(`/${phoneNumberId}/messages`, accessToken, {
    method: "POST",
    body: payload,
  });
}

/**
 * Send a marketing-category template via MM API for WhatsApp.
 * POST /{phone_number_id}/marketing_messages
 */
export async function sendMarketingTemplateMessage({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  languageCode,
  bodyParameters = [],
  headerParameters = [],
  productPolicy,
  messageActivitySharing,
  callbackData,
}) {
  const components = [];

  if (headerParameters.length) {
    components.push({
      type: "header",
      parameters: headerParameters.map((text) => ({
        type: "text",
        text: String(text),
      })),
    });
  }

  if (bodyParameters.length) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((text) => ({
        type: "text",
        text: String(text),
      })),
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/\D/g, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length ? { components } : {}),
    },
    ...(productPolicy ? { product_policy: productPolicy } : {}),
    ...(messageActivitySharing != null
      ? { message_activity_sharing: messageActivitySharing }
      : {}),
    ...(callbackData ? { biz_opaque_callback_data: String(callbackData) } : {}),
  };

  return graphFetch(`/${phoneNumberId}/marketing_messages`, accessToken, {
    method: "POST",
    body: payload,
  });
}

/** Fetch message status by WAMID (best-effort poll; webhooks are primary). */
export async function getWhatsAppMessageStatus(messageId, accessToken) {
  if (!messageId?.trim()) return null;
  try {
    return await graphFetch(
      `/${messageId}?fields=status,errors`,
      accessToken,
      { method: "GET" }
    );
  } catch {
    return null;
  }
}

function mapMetaMessageStatus(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "read") return { activity: "read" };
  if (s === "delivered") return { activity: "delivered" };
  if (s === "failed") return { activity: "failed" };
  if (s === "sent") return { activity: "sent" };
  return null;
}

export function engagementFromMetaMessageStatus(data) {
  const status = data?.status ?? data?.message_status;
  return mapMetaMessageStatus(status);
}
