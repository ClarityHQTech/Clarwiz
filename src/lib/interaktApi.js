const INTERAKT_BASE = "https://api.interakt.ai/v1/public";

function authHeader(apiKey) {
  return { Authorization: `Basic ${apiKey}` };
}

async function interaktFetch(path, apiKey, { method = "GET", body } = {}) {
  const res = await fetch(`${INTERAKT_BASE}${path}`, {
    method,
    headers: {
      ...authHeader(apiKey),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      data?.detail ||
      `Interakt API error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return data;
}

/** Probe API key by fetching one contact page. */
export async function validateInteraktConnection(apiKey) {
  return interaktFetch("/apis/users/?offset=0&limit=1", apiKey, {
    method: "POST",
    body: { filters: [] },
  });
}

/**
 * Interakt does not document a public template-list endpoint.
 * Try known internal paths; callers may fall back to Meta Graph API.
 */
export async function listInteraktTemplates(apiKey) {
  const attempts = [
    { method: "GET", path: "/templates/" },
    { method: "GET", path: "/template/list/" },
    { method: "POST", path: "/apis/templates/?offset=0&limit=200", body: { filters: [] } },
    { method: "GET", path: "/apis/templates/?offset=0&limit=200" },
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      const data = await interaktFetch(attempt.path, apiKey, {
        method: attempt.method,
        body: attempt.body,
      });
      const list = extractTemplateList(data);
      if (list.length) return list;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Could not fetch templates from Interakt");
}

function extractTemplateList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.templates)) return data.templates;
  if (Array.isArray(data?.templates_list)) return data.templates_list;
  return [];
}

export function normalizeInteraktTemplates(rawList) {
  return (rawList ?? []).map((t) => {
    let buttons = t.buttons;
    if (typeof buttons === "string") {
      try {
        buttons = JSON.parse(buttons);
      } catch {
        buttons = null;
      }
    }

    let bodyText = t.body ?? "";
    let bodyVariableCount = (String(bodyText).match(/\{\{\d+\}\}/g) ?? []).length;
    if (t.body_text) {
      try {
        const vars = JSON.parse(t.body_text);
        if (Array.isArray(vars)) bodyVariableCount = vars.length;
      } catch {
        /* ignore */
      }
    }
    const headerText = t.header_text ?? t.header ?? "";
    const headerVariableCount = (String(headerText).match(/\{\{\d+\}\}/g) ?? [])
      .length;

    return {
      id: t.wa_template_id ?? t.id ?? t.name,
      name: t.name,
      displayName: t.display_name ?? t.name,
      language: t.language ?? "en",
      category: t.category ?? null,
      status: t.approval_status ?? t.status ?? "UNKNOWN",
      body: bodyText,
      header: t.header_text ?? t.header ?? null,
      footer: t.footer ?? null,
      buttons,
      components: [],
      variableCount: bodyVariableCount,
      bodyVariableCount,
      headerVariableCount,
      source: "interakt",
    };
  });
}

/** Send template via Interakt public message API. */
export async function sendInteraktTemplate({
  apiKey,
  countryCode,
  phoneNumber,
  templateName,
  languageCode = "en",
  bodyValues = [],
  headerValues = [],
  buttonValues = {},
  callbackData,
}) {
  const payload = {
    countryCode,
    phoneNumber: String(phoneNumber).replace(/\D/g, ""),
    type: "Template",
    template: {
      name: templateName,
      languageCode,
      ...(bodyValues.length ? { bodyValues } : {}),
      ...(headerValues.length ? { headerValues } : {}),
      ...(Object.keys(buttonValues).length ? { buttonValues } : {}),
    },
  };

  if (callbackData) payload.callbackData = callbackData;

  return interaktFetch("/message/", apiKey, {
    method: "POST",
    body: payload,
  });
}

/** Split E.164 or combined phone into country code + local number. */
export function splitPhoneNumber(phone, defaultCountryCode = "+91") {
  const digits = String(phone).replace(/\D/g, "");
  if (phone?.startsWith("+")) {
    if (digits.startsWith("91") && digits.length > 10) {
      return { countryCode: "+91", phoneNumber: digits.slice(2) };
    }
    if (digits.startsWith("1") && digits.length === 11) {
      return { countryCode: "+1", phoneNumber: digits.slice(1) };
    }
  }
  return {
    countryCode: defaultCountryCode,
    phoneNumber: digits,
  };
}
