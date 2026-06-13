/**
 * AE Assist agent — Claude tool-use agent for Cockpit (internal AE chat assist).
 * Grounded in the AE's CRM context via read-only tools, then answers.
 */
import { getAnthropicClient, ASSIST_AGENT_MODEL } from "@/lib/anthropicClient";
import { getDashboardData, getDealView, getCompanyView } from "@/lib/assist/insightsReader";
import { buildChatSystemPrompt } from "@/lib/assist/chatContext";

const clamp = (s, n = 240) => (s == null ? null : String(s).slice(0, n));

// ── pure compaction (bounded JSON for the model) ───────────────────────────
export function compactPipeline(data) {
  return {
    kind: "dashboard",
    openDeals: (data?.deals ?? []).slice(0, 12).map((d) => ({
      id: d.id,
      name: d.name,
      stage: d.stageLabel,
      amount: d.amount,
      status: d.status,
      score: d.score,
    })),
    leads: (data?.leads ?? []).slice(0, 12).map((c) => ({
      id: c.id,
      name: c.businessUser?.name ?? null,
      company: c.businessUser?.company?.name ?? null,
    })),
    accounts: (data?.accounts ?? []).slice(0, 12).map((a) => ({
      id: a.id,
      name: a.company?.name ?? null,
      deals: a._count?.deals ?? 0,
    })),
  };
}

export function compactDeal(view) {
  if (!view?.deal) return { kind: "empty" };
  return {
    kind: "deal",
    deal: {
      id: view.deal.id,
      name: view.deal.name,
      stage: view.deal.stageLabel,
      amount: view.deal.amount,
      status: view.deal.status,
      score: view.deal.score,
    },
    company: view.company ? { name: view.company.name, industry: view.company.industry } : null,
    insightSummary: clamp(view.insight?.summary ?? view.insight?.briefing ?? null),
    topSignals: (view.signals ?? []).slice(0, 5).map((s) => ({
      headline: s.headline,
      category: s.category ?? s.type,
      score: s.score,
    })),
    topNbas: (view.nbas ?? []).slice(0, 5).map((n) => ({
      title: n.title,
      actionType: n.actionType,
      status: n.status,
      score: n.score,
    })),
  };
}

export function compactCompany(view) {
  if (!view?.account) return { kind: "empty" };
  return {
    kind: "company",
    account: { id: view.account.id },
    company: view.company ? { name: view.company.name, industry: view.company.industry } : null,
    deals: (view.deals ?? []).slice(0, 8).map((d) => ({
      id: d.id,
      name: d.name,
      stage: d.stageLabel,
      status: d.status,
    })),
    topSignals: (view.signals ?? []).slice(0, 5).map((s) => ({ headline: s.headline, score: s.score })),
  };
}

// ── tools ──────────────────────────────────────────────────────────────────
export const ASSIST_TOOLS = [
  {
    name: "get_pipeline_overview",
    description:
      "Get the AE's current pipeline — open deals, MQL leads, and accounts. Call this when the question spans multiple deals or asks what to focus on.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_deal_detail",
    description:
      "Get full detail for one deal by id: insight briefing, score, signals, and next best actions. Call this when the user asks about a specific deal.",
    input_schema: {
      type: "object",
      properties: { dealId: { type: "string", description: "Clarwiz deal id" } },
      required: ["dealId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_company_detail",
    description:
      "Get full detail for one account/company by account id: company insight, signals, deals, and contacts.",
    input_schema: {
      type: "object",
      properties: { accountId: { type: "string", description: "Clarwiz account id" } },
      required: ["accountId"],
      additionalProperties: false,
    },
  },
];

export async function executeAssistTool(prisma, tenantId, name, input) {
  try {
    if (name === "get_pipeline_overview") {
      return JSON.stringify(compactPipeline(await getDashboardData(prisma, tenantId, {})));
    }
    if (name === "get_deal_detail") {
      const view = await getDealView(prisma, tenantId, input?.dealId);
      return JSON.stringify(view ? compactDeal(view) : { error: "deal_not_found" });
    }
    if (name === "get_company_detail") {
      const view = await getCompanyView(prisma, tenantId, input?.accountId);
      return JSON.stringify(view ? compactCompany(view) : { error: "account_not_found" });
    }
    return JSON.stringify({ error: "unknown_tool" });
  } catch (err) {
    return JSON.stringify({ error: "tool_failed", message: err.message });
  }
}

async function groundSnapshot(prisma, tenantId, pageContext) {
  try {
    if (pageContext?.entityType === "deal" && pageContext.id) {
      return compactDeal(await getDealView(prisma, tenantId, pageContext.id));
    }
    if (pageContext?.entityType === "account" && pageContext.id) {
      return compactCompany(await getCompanyView(prisma, tenantId, pageContext.id));
    }
    return compactPipeline(await getDashboardData(prisma, tenantId, {}));
  } catch {
    return { kind: "empty" };
  }
}

/**
 * Run the AE-assist agent. Returns { reply, iterations }.
 * `client`, `executeTool`, and `ground` are injectable for testing.
 */
export async function runAssistAgent({
  prisma,
  tenantId,
  messages,
  pageContext = {},
  client,
  model = ASSIST_AGENT_MODEL,
  maxIterations = 6,
  executeTool = executeAssistTool,
  ground = groundSnapshot,
}) {
  const llm = client || getAnthropicClient();
  const snapshot = await ground(prisma, tenantId, pageContext);
  const system = buildChatSystemPrompt({ pageContext, snapshot });
  const convo = [...messages];

  for (let i = 0; i < maxIterations; i++) {
    const res = await llm.messages.create({
      model,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system,
      tools: ASSIST_TOOLS,
      messages: convo,
    });

    if (res.stop_reason === "tool_use") {
      convo.push({ role: "assistant", content: res.content });
      const toolResults = [];
      for (const block of res.content || []) {
        if (block.type === "tool_use") {
          const out = await executeTool(prisma, tenantId, block.name, block.input);
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
    return { reply: text || "(no response)", iterations: i + 1 };
  }

  return {
    reply: "I wasn't able to finish that — try narrowing the question to one deal or account.",
    iterations: maxIterations,
  };
}
