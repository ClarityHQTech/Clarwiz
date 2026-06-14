import { buildProviderMetadata } from "@/lib/execution/openaiUsage";
import { mergeAssistProviderFields } from "@/lib/assist/providerMetadata";
import { getAnthropicClient, ASSIST_AGENT_MODEL } from "@/lib/anthropicClient";
import { buildChatSystemPrompt } from "@/lib/assist/chatContext";
import { buildCockpitDealSnapshot } from "@/lib/assist/cockpit/dealContext";
import {
  COCKPIT_DEAL_TOOLS,
  executeCockpitDealTool,
  getCachedCockpitRawContext,
} from "@/lib/assist/cockpit/dealTools";

async function groundDealSnapshot(prisma, tenantId, pageContext) {
  const dealId = pageContext?.id;
  if (pageContext?.entityType !== "deal" || !dealId) {
    return { kind: "empty", error: "cockpit_requires_deal_context" };
  }
  await getCachedCockpitRawContext(prisma, tenantId, dealId);
  return buildCockpitDealSnapshot(prisma, tenantId, dealId);
}

/**
 * Run Cockpit for a deal workroom. Returns { reply, iterations }.
 */
export async function runAssistAgent({
  prisma,
  tenantId,
  messages,
  pageContext = {},
  client,
  model = ASSIST_AGENT_MODEL,
  maxIterations = 8,
  executeTool,
  ground,
}) {
  const dealId = pageContext?.id;
  if (pageContext?.entityType !== "deal" || !dealId) {
    return {
      reply:
        "Cockpit is only available inside a deal workroom. Open a deal to ask questions about that opportunity.",
      iterations: 0,
    };
  }

  const llm = client || getAnthropicClient();
  const groundFn = ground ?? groundDealSnapshot;
  const toolFn =
    executeTool ??
    ((p, t, _dealId, name, input) => executeCockpitDealTool(p, t, dealId, name, input));

  const snapshot = await groundFn(prisma, tenantId, pageContext);
  if (snapshot?.kind === "empty" && snapshot?.error !== "cockpit_requires_deal_context") {
    return { reply: "This deal could not be loaded. Refresh the page and try again.", iterations: 0 };
  }

  const system = buildChatSystemPrompt({ pageContext, snapshot });
  const convo = [...messages];
  const usageCalls = [];

  for (let i = 0; i < maxIterations; i++) {
    const res = await llm.messages.create({
      model,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system,
      tools: COCKPIT_DEAL_TOOLS,
      messages: convo,
    });
    usageCalls.push(buildProviderMetadata(res, model));

    if (res.stop_reason === "tool_use") {
      convo.push({ role: "assistant", content: res.content });
      const toolResults = [];
      for (const block of res.content || []) {
        if (block.type === "tool_use") {
          const out = await toolFn(prisma, tenantId, dealId, block.name, block.input);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out });
        }
      }
      convo.push({ role: "user", content: toolResults });
      continue;
    }

    const text = (res.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const providerFields = mergeAssistProviderFields(usageCalls);
    return {
      reply: text || "(no response)",
      iterations: i + 1,
      ...providerFields,
    };
  }

  const providerFields = mergeAssistProviderFields(usageCalls);
  return {
    reply: "I need a more specific question about this deal — try asking about a contact, signal, or next step.",
    iterations: maxIterations,
    ...providerFields,
  };
}
