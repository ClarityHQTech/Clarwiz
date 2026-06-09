import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAssistAction } from "@/lib/assist/logAction";
import { runAssistAgent } from "@/lib/assist/assistAgent";

const MAX_HISTORY = 16;

/** Keep only well-formed {role, content} turns and clamp history length. */
function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }));
}

/**
 * POST { messages:[{role,content}], pageContext:{entityType?, id?, name?} }
 * → { reply }. Runs the Claude (Anthropic SDK) AE-assist tool-use agent grounded
 * in the AE's CRM context — it may call read-only tools (pipeline/deal/account)
 * before answering. Logs a CHAT_QUERY action (no message text). Returns 502
 * { error:'chat_failed' } on an agent failure.
 *
 * `agentClient` is injectable for tests; production uses the Anthropic client.
 */
export async function POST(request, { agentClient } = {}) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.ASSIST_VIEW });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = sanitizeMessages(body?.messages);
  if (messages.length === 0) {
    return NextResponse.json({ error: "empty_messages" }, { status: 400 });
  }
  const pageContext = body?.pageContext ?? {};

  let reply;
  try {
    const result = await runAssistAgent({
      prisma,
      tenantId: ctx.tenantId,
      messages,
      pageContext,
      client: agentClient,
    });
    reply = result.reply;
  } catch (err) {
    console.warn(`[MOFU] assist agent failed: ${err.message}`);
    return NextResponse.json({ error: "chat_failed" }, { status: 502 });
  }

  // Fire-and-forget log — NO message text, only metadata.
  await logAssistAction(prisma, {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user?.id ?? null,
    entityType: "chat",
    hsObjectId: null,
    action: "CHAT_QUERY",
    payload: {
      threadId: typeof body?.threadId === "string" ? body.threadId : undefined,
      entityType: pageContext?.entityType ?? "pipeline",
      hsObjectId: pageContext?.id ?? undefined,
    },
  });

  return NextResponse.json({ reply });
}
