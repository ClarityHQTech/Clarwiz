import { describe, it, expect, vi } from "vitest";
import { resolveBrand } from "@/lib/mofu/collateral/brand";
import { renderTemplate } from "@/lib/mofu/collateral/renderer";
import { generateMarketingCollateral } from "@/lib/mofu/collateral/pathA";
import { enqueueSalesCollateral, runPathBPipeline, reEnrichSalesCollateral } from "@/lib/mofu/collateral/pathB";

describe("Path A collateral (US-7.1)", () => {
  it("brand cascade: defaults <- tenant <- client", () => {
    const b = resolveBrand({ tenant: { accentColor: "#111" }, client: { companyName: "Acme" } });
    expect(b.companyName).toBe("Acme");
    expect(b.accentColor).toBe("#111");
    expect(b.primaryColor).toBe("#1a1a1a"); // default retained
  });

  it("renderer is deterministic and never emits a blank token", () => {
    const brand = resolveBrand({});
    const a = renderTemplate("one_pager", { headline: "Hi" }, brand);
    const b = renderTemplate("one_pager", { headline: "Hi" }, brand);
    expect(a).toBe(b);
    expect(a).not.toContain("undefined");
    expect(a).toContain("Faster execution"); // default value props when none provided
  });

  it("unknown template throws", () => {
    expect(() => renderTemplate("nope", {}, {})).toThrow();
  });

  it("creates a READY path-A Document", async () => {
    const prisma = { document: { create: vi.fn(async (a) => ({ id: "doc_1", ...a.data })) } };
    const out = await generateMarketingCollateral({ tenantId: "t1", dealId: "deal_1", data: { headline: "X" } }, { prisma });
    expect(out.ok).toBe(true);
    expect(prisma.document.create.mock.calls[0][0].data).toMatchObject({ path: "A", status: "READY" });
  });
});

describe("Path B collateral (US-8.1)", () => {
  function store(doc) {
    const state = { ...doc };
    return {
      state,
      prisma: {
        document: {
          create: vi.fn(async (a) => { Object.assign(state, { id: "doc_b", ...a.data }); return { ...state }; }),
          findUnique: vi.fn(async () => ({ ...state })),
          update: vi.fn(async ({ data }) => { Object.assign(state, data); return { ...state }; }),
        },
      },
    };
  }

  it("enqueue creates a DRAFT path-B job", async () => {
    const s = store({});
    const out = await enqueueSalesCollateral({ tenantId: "t1", dealId: "deal_1", brief: "battlecard vs X" }, { prisma: s.prisma });
    expect(out.ok).toBe(true);
    expect(s.state.status).toBe("DRAFT");
    expect(s.state.path).toBe("B");
  });

  it("pipeline run -> READY with a stage trace and asset", async () => {
    const s = store({ id: "doc_b", status: "DRAFT", path: "B", contentJson: { brief: "b" } });
    const generate = vi.fn(async () => ({ data: { title: "Battlecard", html: "<h1>x</h1>" }, model: "gpt-4o", usage: {}, cost: {} }));
    const jury = vi.fn(async () => ({ result: { approved: true, confidence: 0.9 }, juryResult: { reconciliation: { mode: "agreement" } } }));
    const out = await runPathBPipeline("doc_b", { prisma: s.prisma, generate, jury });
    expect(out.ok).toBe(true);
    expect(s.state.status).toBe("READY");
    expect(s.state.contentJson.trace.map((t) => t.stage)).toContain("generate");
  });

  it("pipeline failure leaves DRAFT (no half-written READY)", async () => {
    const s = store({ id: "doc_b", status: "DRAFT", path: "B", contentJson: { brief: "b" } });
    const generate = vi.fn(async () => { throw new Error("llm_down"); });
    const out = await runPathBPipeline("doc_b", { prisma: s.prisma, generate });
    expect(out).toMatchObject({ ok: false, retryable: true });
    expect(s.state.status).toBe("DRAFT");
  });

  it("re-enrich bumps the version and re-runs", async () => {
    const s = store({ id: "doc_b", status: "READY", path: "B", version: 1, contentJson: { brief: "b" } });
    const generate = vi.fn(async () => ({ data: { title: "v2", html: "<h1>v2</h1>" }, model: "gpt-4o", usage: {}, cost: {} }));
    const jury = vi.fn(async () => { throw new Error("skip"); });
    const out = await reEnrichSalesCollateral("doc_b", "make it punchier", { prisma: s.prisma, generate, jury });
    expect(out.ok).toBe(true);
    expect(s.state.version).toBe(2);
  });
});
