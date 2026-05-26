const LINKUP_BASE = "https://api.linkupapi.com/v2";

function getApiKey() {
  const key = process.env.LINKUP_API_KEY;
  if (!key) {
    throw new Error("LINKUP_API_KEY is not configured");
  }
  return key;
}

async function linkupRequest(path, body) {
  const res = await fetch(`${LINKUP_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok && data?.success !== false) {
    return {
      success: false,
      error: {
        code: "HTTP_ERROR",
        message: data?.error?.message || `LinkupAPI request failed (${res.status})`,
      },
      metadata: data?.metadata,
    };
  }

  return data;
}

export async function linkupLogin({ email, password, country = "US", accountName }) {
  return linkupRequest("/login", {
    platform: "linkedin",
    email,
    password,
    country,
    account_name: accountName,
  });
}

export async function linkupCheckpoint({ accountId, code }) {
  const body = { account_id: accountId };
  if (code) body.code = code;
  return linkupRequest("/checkpoint", body);
}

/** V2 action endpoint — POST /v2/{category} with account_id, action, params. */
export async function linkupAction(category, { accountId, action, params = {} }) {
  const path = category.startsWith("/") ? category : `/${category}`;
  return linkupRequest(path, {
    account_id: accountId,
    action,
    params,
  });
}

function assertLinkupSuccess(result, fallbackMessage) {
  if (result?.success) return result;
  const message =
    result?.error?.message || fallbackMessage || "LinkupAPI request failed";
  const err = new Error(message);
  err.code = result?.error?.code;
  err.metadata = result?.metadata;
  throw err;
}

/** POST /v2/messages — action send. */
export async function linkupSendMessage({
  accountId,
  profileUrl,
  messageText,
  mediaLink,
  mediaFile,
  mediaPath,
}) {
  const params = {
    profile_url: profileUrl,
    message_text: messageText,
  };
  if (mediaLink) params.media_link = mediaLink;
  if (mediaFile) params.media_file = mediaFile;
  if (mediaPath) params.media_path = mediaPath;

  const result = await linkupAction("messages", {
    accountId,
    action: "send",
    params,
  });
  return assertLinkupSuccess(result, "Failed to send LinkedIn message");
}

/** POST /v2/network — action invite. */
export async function linkupSendConnectionRequest({
  accountId,
  profileUrl,
  identifier,
  message,
}) {
  const params = {};
  if (profileUrl) params.profile_url = profileUrl;
  if (identifier) params.identifier = identifier;
  if (message) params.message = message;

  const result = await linkupAction("network", {
    accountId,
    action: "invite",
    params,
  });
  return assertLinkupSuccess(result, "Failed to send LinkedIn connection request");
}

/** POST /v2/network — action list_connections. */
export async function linkupListConnections({
  accountId,
  count = 100,
  offset = 0,
}) {
  const result = await linkupAction("network", {
    accountId,
    action: "list_connections",
    params: { count, offset },
  });
  return assertLinkupSuccess(result, "Failed to list LinkedIn connections");
}

/** POST /v2/network — action check_invitation (1 credit). */
export async function linkupCheckInvitation({ accountId, profileUrl }) {
  const result = await linkupAction("network", {
    accountId,
    action: "check_invitation",
    params: { profile_url: profileUrl },
  });
  return assertLinkupSuccess(result, "Failed to check LinkedIn invitation status");
}

/** POST /v2/messages — action list_inbox. */
export async function linkupListInbox({
  accountId,
  totalResults = 50,
  category = "INBOX",
  nextCursor,
}) {
  const params = { total_results: totalResults, category };
  if (nextCursor) params.next_cursor = nextCursor;

  const result = await linkupAction("messages", {
    accountId,
    action: "list_inbox",
    params,
  });
  return assertLinkupSuccess(result, "Failed to list LinkedIn inbox");
}

/** POST /v2/messages — action get_conversation. */
export async function linkupGetConversation({
  accountId,
  profileUrl,
  conversationId,
  count = 10,
  cursor,
}) {
  const params = { count };
  if (conversationId) params.conversation_id = conversationId;
  if (profileUrl) params.profile_url = profileUrl;
  if (cursor) params.cursor = cursor;

  const result = await linkupAction("messages", {
    accountId,
    action: "get_conversation",
    params,
  });
  return assertLinkupSuccess(result, "Failed to get LinkedIn conversation");
}
