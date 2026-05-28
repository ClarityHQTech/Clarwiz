import { prisma } from "@/lib/prisma";
import {
  buildBasePayload,
  callGtmCoreTool,
  truncateGtmContextField,
} from "@/lib/gtmCoreApi";

export const ICP_PIPELINE_STEPS = [
  { key: "icp_gap_analysis", field: "icpGapAnalysis", label: "ICP gap analysis" },
  { key: "market_research", field: "marketResearch", label: "Market research" },
  { key: "value_proposition", field: "valueProposition", label: "Value proposition" },
  { key: "icp", field: "icpWorkbook", label: "ICP workbook" },
];

const PIPELINE_STEPS = ICP_PIPELINE_STEPS;

function buildStepBody(record, stepKey) {
  const base = buildBasePayload({
    companyName: record.companyName,
    companyDomain: record.companyDomain,
    relevantData: record.relevantData,
    userQuery: record.userQuery,
  });

  const body = { ...base };
  if (record.icpGapAnalysis) {
    body.icp_gap_analysis = truncateGtmContextField(
      "icp_gap_analysis",
      record.icpGapAnalysis
    );
  }
  if (record.marketResearch) {
    body.market_research = truncateGtmContextField(
      "market_research",
      record.marketResearch
    );
  }
  if (record.valueProposition) {
    body.value_proposition = truncateGtmContextField(
      "value_proposition",
      record.valueProposition
    );
  }

  const step = PIPELINE_STEPS.find((s) => s.key === stepKey);
  if (!step) throw new Error(`Unknown pipeline step: ${stepKey}`);

  if (step.key === "value_proposition" && !record.marketResearch) {
    throw new Error("Market research must complete before value proposition");
  }
  if (step.key === "icp" && (!record.marketResearch || !record.valueProposition)) {
    throw new Error("Market research and value proposition must complete before ICP workbook");
  }

  return body;
}

/** Steps not yet stored — if all done, returns full pipeline (re-run). */
export function getPipelineStepsToRun(context) {
  const done = {
    icp_gap_analysis: context?.hasIcpGapAnalysis,
    market_research: context?.hasMarketResearch,
    value_proposition: context?.hasValueProposition,
    icp: context?.hasIcpWorkbook,
  };
  const remaining = PIPELINE_STEPS.filter((s) => !done[s.key]);
  return remaining.length > 0 ? remaining : PIPELINE_STEPS;
}

export async function runIcpAnalysisStep(tenantId, stepKey) {
  const step = PIPELINE_STEPS.find((s) => s.key === stepKey);
  if (!step) {
    throw new Error(`Unknown pipeline step: ${stepKey}`);
  }

  const record = await prisma.tenantIcpContext.findUnique({ where: { tenantId } });
  if (!record) {
    throw new Error("Save company details before running analysis");
  }
  requireInputs(record);

  const body = buildStepBody(record, stepKey);
  const isLastStep = stepKey === PIPELINE_STEPS[PIPELINE_STEPS.length - 1].key;

  await prisma.tenantIcpContext.update({
    where: { tenantId },
    data: { status: "analyzing", lastError: null, currentStep: stepKey },
  });

  try {
    const result = await callGtmCoreTool(stepKey, body);
    const output = result.output;
    if (!output) {
      throw new Error(`${stepKey} returned no output`);
    }

    const updated = await prisma.tenantIcpContext.update({
      where: { tenantId },
      data: {
        [step.field]: output,
        status: isLastStep ? "complete" : "analyzing",
        currentStep: isLastStep ? null : stepKey,
        lastError: null,
        ...(isLastStep ? { analyzedAt: new Date() } : {}),
      },
    });

    return serializeTenantIcpContext(updated);
  } catch (err) {
    await prisma.tenantIcpContext.update({
      where: { tenantId },
      data: { status: "error", lastError: err.message },
    });
    throw err;
  }
}

export function serializeTenantIcpContext(record) {
  if (!record) return null;
  return {
    id: record.id,
    companyName: record.companyName,
    companyDomain: record.companyDomain,
    relevantData: record.relevantData,
    userQuery: record.userQuery,
    accountData: record.accountData,
    status: record.status,
    currentStep: record.currentStep,
    hasIcpGapAnalysis: Boolean(record.icpGapAnalysis),
    hasMarketResearch: Boolean(record.marketResearch),
    hasValueProposition: Boolean(record.valueProposition),
    hasIcpWorkbook: Boolean(record.icpWorkbook),
    hasAccountSignals: Boolean(record.accountSignals),
    icpGapAnalysisPreview: preview(record.icpGapAnalysis),
    marketResearchPreview: preview(record.marketResearch),
    valuePropositionPreview: preview(record.valueProposition),
    icpWorkbookPreview: preview(record.icpWorkbook),
    accountSignalsPreview: preview(record.accountSignals),
    lastError: record.lastError,
    analyzedAt: record.analyzedAt?.toISOString?.() ?? null,
    updatedAt: record.updatedAt?.toISOString?.() ?? null,
  };
}

function preview(text, max = 280) {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export async function getTenantIcpContext(tenantId) {
  const record = await prisma.tenantIcpContext.findUnique({
    where: { tenantId },
  });
  return serializeTenantIcpContext(record);
}

export async function getTenantIcpContextForExecution(tenantId) {
  const record = await prisma.tenantIcpContext.findUnique({
    where: { tenantId },
  });
  if (!record || record.status !== "complete") return null;
  return {
    companyName: record.companyName,
    companyDomain: record.companyDomain,
    icpGapAnalysis: record.icpGapAnalysis,
    marketResearch: record.marketResearch,
    valueProposition: record.valueProposition,
    icpWorkbook: record.icpWorkbook,
    accountSignals: record.accountSignals,
    analyzedAt: record.analyzedAt,
  };
}

export async function upsertTenantIcpInputs(tenantId, inputs) {
  const data = {};
  if (inputs.companyName !== undefined) data.companyName = inputs.companyName?.trim() || null;
  if (inputs.companyDomain !== undefined) {
    data.companyDomain = inputs.companyDomain?.trim() || null;
  }
  if (inputs.relevantData !== undefined) data.relevantData = inputs.relevantData?.trim() || null;
  if (inputs.userQuery !== undefined) data.userQuery = inputs.userQuery?.trim() || null;
  if (inputs.accountData !== undefined) data.accountData = inputs.accountData?.trim() || null;

  const record = await prisma.tenantIcpContext.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });

  return serializeTenantIcpContext(record);
}

function requireInputs(record) {
  if (!record.companyName?.trim() || !record.companyDomain?.trim() || !record.relevantData?.trim()) {
    throw new Error("company_name, company_domain, and relevant_data are required");
  }
}

export async function runAccountSignalExtraction(tenantId) {
  const record = await prisma.tenantIcpContext.findUnique({ where: { tenantId } });
  if (!record) {
    throw new Error("Save company details before extracting account signals");
  }
  if (!record.companyName?.trim() || !record.companyDomain?.trim()) {
    throw new Error("company_name and company_domain are required");
  }
  if (!record.accountData?.trim()) {
    throw new Error("account_data is required for signal extraction");
  }

  const body = {
    company_name: record.companyName.trim(),
    company_domain: record.companyDomain.trim(),
    account_data: truncateGtmContextField("account_data", record.accountData.trim()),
  };
  if (record.userQuery?.trim()) body.user_query = record.userQuery.trim();
  if (record.icpWorkbook) {
    body.icp = truncateGtmContextField("icp", record.icpWorkbook);
  }

  await prisma.tenantIcpContext.update({
    where: { tenantId },
    data: { status: "analyzing", currentStep: "account_signal_extractor", lastError: null },
  });

  try {
    const result = await callGtmCoreTool("account_signal_extractor", body);
    const output = result.output;
    if (!output) {
      throw new Error("account_signal_extractor returned no output");
    }

    const updated = await prisma.tenantIcpContext.update({
      where: { tenantId },
      data: {
        accountSignals: output,
        status: record.icpWorkbook ? "complete" : record.status,
        currentStep: null,
        lastError: null,
      },
    });

    return serializeTenantIcpContext(updated);
  } catch (err) {
    await prisma.tenantIcpContext.update({
      where: { tenantId },
      data: { status: "error", lastError: err.message, currentStep: null },
    });
    throw err;
  }
}

export function buildExecutionTenantContext(campaign, tenantIcp) {
  const base = {
    campaignName: campaign.name,
    description: campaign.description,
    targetSegment: campaign.targetSegment,
    goals: campaign.goals,
    brandTone: "professional, concise, value-led",
  };

  if (!tenantIcp) return base;

  return {
    ...base,
    companyName: tenantIcp.companyName,
    companyDomain: tenantIcp.companyDomain,
    icp: {
      gapAnalysis: truncateForPrompt(tenantIcp.icpGapAnalysis, 2000),
      marketResearch: truncateForPrompt(tenantIcp.marketResearch, 2500),
      valueProposition: truncateForPrompt(tenantIcp.valueProposition, 2000),
      workbook: truncateForPrompt(tenantIcp.icpWorkbook, 4000),
      accountSignals: truncateForPrompt(tenantIcp.accountSignals, 1500),
    },
  };
}

function truncateForPrompt(text, max) {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
