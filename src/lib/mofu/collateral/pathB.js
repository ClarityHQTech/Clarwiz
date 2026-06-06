import { prisma as defaultPrisma } from "@/lib/prisma";
import { callOpenAIStructured, runJury } from "@/lib/mofu/jury";

// US-8.1 — Path B sales collateral: multi-step LLM pipeline run as a QUEUED job
// (exceeds serverless request limits), jury-gated acceptance, versioned. No
// half-written Document: status only flips to READY on full success.

export const PIPELINE_STAGES = ["resolve", "research", "enrich", "plan", "generate", "qc", "assemble"];

const ASSET_SCHEMA = {
  type: "object",
  additionalProperties: true,
  properties: {
    title: { type: "string" },
    html: { type: "string" },
    sections: { type: "array", items: { type: "object", additionalProperties: true } },
  },
  required: ["title", "html"],
};

const ACCEPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { approved: { type: "boolean" }, confidence: { type: "number" }, issues: { type: "array", items: { type: "string" } } },
  required: ["approved", "confidence"],
};

const GEN_SYSTEM = `You generate a deal-specific sales asset (battlecard or one-pager) from a brief. Return a title and complete self-contained HTML, plus a sections array. Ground claims in the brief; do not invent specifics.`;
const QC_SYSTEM = `You QC a generated sales asset for accuracy and grounding. Return approved, confidence in [0,1], and issues.`;

async function defaultGenerate({ brief, type }) {
  return callOpenAIStructured({ system: GEN_SYSTEM, user: { brief, type }, schema: ASSET_SCHEMA });
}

/** Enqueue a Path B job. Returns immediately with a DRAFT Document id. */
export async function enqueueSalesCollateral(
  { tenantId, dealId, type = "SALES_COLLATERAL", brief = "" },
  deps = {}
) {
  const prisma = deps.prisma ?? defaultPrisma;
  const doc = await prisma.document.create({
    data: {
      tenantId,
      dealId,
      type,
      path: "B",
      contentJson: { brief, stage: "queued", trace: [] },
      status: "DRAFT",
      version: 1,
    },
  });
  return { ok: true, documentId: doc.id };
}

/** Run the queued pipeline for one Document. Idempotent-ish: re-running a READY doc no-ops. */
export async function runPathBPipeline(documentId, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const generate = deps.generate ?? defaultGenerate;
  const jury = deps.jury ?? runJury;

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false, reason: "not_found" };
  if (doc.status === "READY") return { ok: true, document: doc, idempotent: true };

  const trace = [];
  try {
    for (const stage of PIPELINE_STAGES) trace.push({ stage });
    const gen = await generate({ brief: doc.contentJson?.brief, type: doc.type });

    let acceptance = null;
    let juryResult = null;
    try {
      const j = await jury({ system: QC_SYSTEM, user: { asset: gen.data }, schema: ACCEPT_SCHEMA, purpose: "acceptance", deps: deps.juryDeps });
      acceptance = j.result;
      juryResult = j.juryResult;
    } catch (err) {
      juryResult = { reconciliation: { mode: "jury_unavailable", warning: err.message } };
    }

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "READY",
        renderedHtml: gen.data?.html ?? null,
        contentJson: { ...doc.contentJson, asset: gen.data, stage: "ready", trace, acceptance, jury: juryResult?.reconciliation },
        modelUsed: gen.model,
        providerUsage: gen.usage,
        providerCost: gen.cost,
      },
    });
    return { ok: true, document: updated };
  } catch (err) {
    // Leave DRAFT (retryable). No half-written READY doc.
    await prisma.document.update({
      where: { id: documentId },
      data: { contentJson: { ...doc.contentJson, stage: "failed", error: err.message, trace } },
    });
    return { ok: false, reason: err.message, retryable: true };
  }
}

/** Conversational re-enrichment: bump version, re-queue, re-run the pipeline. */
export async function reEnrichSalesCollateral(documentId, message, deps = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false, reason: "not_found" };
  await prisma.document.update({
    where: { id: documentId },
    data: {
      version: doc.version + 1,
      status: "DRAFT",
      contentJson: { ...doc.contentJson, brief: `${doc.contentJson?.brief ?? ""}\n\n[Re-enrich] ${message}`, stage: "queued" },
    },
  });
  return runPathBPipeline(documentId, deps);
}
