import { prisma as defaultPrisma } from "@/lib/prisma";
import { callOpenAIStructured, runJury } from "@/lib/mofu/jury";

// US-3.1 — The Heptapod bundle: executive summary + six dimensions +
// actionable_recommendations + system_metadata. Same shape for DEAL and COMPANY.

const DIMENSION = {
  type: "object",
  additionalProperties: true,
  properties: { summary: { type: "string" }, findings: { type: "array", items: { type: "string" } } },
};

export const BUNDLE_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    executive_intelligence_summary: { type: "object", additionalProperties: true },
    heptapod_dimensional_analysis: {
      type: "object",
      additionalProperties: true,
      properties: {
        stakeholder: DIMENSION,
        value: DIMENSION,
        risk: DIMENSION,
        temporal: DIMENSION,
        competitive: DIMENSION,
        expansion: DIMENSION,
      },
    },
    actionable_recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          action_type: { type: "string" },
          title: { type: "string" },
          signal_reference_id: { type: ["string", "null"] },
          rationale: { type: "string" },
        },
      },
    },
    system_metadata: {
      type: "object",
      additionalProperties: true,
      properties: { confidence: { type: "number" }, data_completeness: { type: "number" } },
    },
  },
  required: ["heptapod_dimensional_analysis", "actionable_recommendations", "system_metadata"],
};

const ACCEPTANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    approved: { type: "boolean" },
    confidence: { type: "number" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["approved", "confidence"],
};

const GEN_SYSTEM = `You are Clarwiz's deal intelligence engine. Analyze the provided deal/company context and signals into a fixed dimensional bundle: an executive summary, six intelligences (stakeholder, value, risk, temporal, competitive, expansion), a list of actionable_recommendations (each with action_type, title, signal_reference_id citing a real signal id when applicable, and rationale), and system_metadata with confidence and data_completeness in [0,1]. When data is thin, set low data_completeness and DO NOT invent specifics. Use only the closed action_type set: SEND_EMAIL, SEND_MARKETING_COLLATERAL, SEND_SALES_COLLATERAL, SCHEDULE_MEETING, CALL_WITH_SCRIPT, PREP_MEETING, UPDATE_CRM_CREATE_TASK, NOTIFY_TEAM.`;

const ACCEPTANCE_SYSTEM = `You are a strict reviewer. Given a generated deal intelligence bundle and the count of source signals, decide if it is acceptable (grounded, no hallucinated specifics, dimensions consistent with available data). Return approved, a confidence in [0,1], and any issues.`;

async function defaultGenerate({ scope, context, signals, tenantIcp }) {
  return callOpenAIStructured({
    system: GEN_SYSTEM,
    user: { scope, context, signals, tenantIcp },
    schema: BUNDLE_SCHEMA,
  });
}

const HD = (b) => b?.heptapod_dimensional_analysis ?? {};

/**
 * Compute and persist a DealInsight (the Heptapod bundle). High-stakes acceptance
 * runs the dual-model jury; bundle still returns if a provider errors (degrade).
 */
export async function computeInsightBundle(
  { tenantId, scope = "DEAL", dealId = null, companyId = null, context, signals = [], tenantIcp = null },
  deps = {}
) {
  const prisma = deps.prisma ?? defaultPrisma;
  const generate = deps.generate ?? defaultGenerate;
  const jury = deps.jury ?? runJury;

  const gen = await generate({ scope, context, signals, tenantIcp });
  const bundle = gen.data;

  let acceptance = null;
  let juryResult = null;
  try {
    const j = await jury({
      system: ACCEPTANCE_SYSTEM,
      user: { bundle, signalCount: signals.length },
      schema: ACCEPTANCE_SCHEMA,
      purpose: "acceptance",
      deps: deps.juryDeps,
    });
    acceptance = j.result;
    juryResult = j.juryResult;
  } catch (err) {
    juryResult = { reconciliation: { mode: "jury_unavailable", warning: err.message } };
  }

  const row = await prisma.dealInsight.create({
    data: {
      tenantId,
      scope,
      dealId,
      companyId,
      executiveSummary: bundle.executive_intelligence_summary ?? null,
      stakeholderIntelligence: HD(bundle).stakeholder ?? null,
      valueIntelligence: HD(bundle).value ?? null,
      riskIntelligence: HD(bundle).risk ?? null,
      temporalIntelligence: HD(bundle).temporal ?? null,
      competitiveIntelligence: HD(bundle).competitive ?? null,
      expansionIntelligence: HD(bundle).expansion ?? null,
      actionableRecommendations: bundle.actionable_recommendations ?? [],
      systemMetadata: { ...(bundle.system_metadata ?? {}), acceptance, jury: juryResult?.reconciliation },
      modelUsed: gen.model,
      providerUsage: gen.usage,
      providerCost: gen.cost,
    },
  });

  return { insightId: row.id, bundle, acceptance, juryResult };
}
