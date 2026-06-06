import { describe, it, expect, vi } from "vitest";
import { generateCollateral, regenerateCollateral } from "@/lib/mofu/collateral/engine";
import { listTemplates, createTemplate } from "@/lib/mofu/templates";

describe("collateral engine (unified, no Path A/B)", () => {
  it("built-in template renders deterministically and persists a Document", async () => {
    const created = [];
    const prisma = { document: { create: vi.fn(async (a) => { created.push(a.data); return { id: "doc1", ...a.data }; }) } };
    const out = await generateCollateral(
      { tenantId: "t1", dealId: "deal_1", templateId: "builtin:one_pager", category: "marketing", context: { company: { name: "Acme" }, deal: { name: "Acme Deal" } } },
      { prisma }
    );
    expect(out.ok).toBe(true);
    expect(out.html).toContain("Acme");
    expect(created[0]).toMatchObject({ category: "marketing", type: "MARKETING_COLLATERAL", status: "READY" });
  });

  it("uploaded template uses the LLM section-fill (injected) and stores category sales", async () => {
    const created = [];
    const prisma = {
      collateralTemplate: { findFirst: vi.fn(async () => ({ id: "tpl1", title: "Battlecard", html: "<x>", category: "sales" })) },
      document: { create: vi.fn(async (a) => { created.push(a.data); return { id: "doc2", ...a.data }; }) },
    };
    const fill = vi.fn(async () => ({ data: { title: "Battlecard", html: "<h1>vs incumbent</h1>" }, model: "gpt-4o", usage: {}, cost: {} }));
    const out = await generateCollateral(
      { tenantId: "t1", dealId: "deal_1", templateId: "tpl1", category: "sales", context: {} },
      { prisma, fill }
    );
    expect(out.ok).toBe(true);
    expect(out.html).toContain("incumbent");
    expect(created[0].category).toBe("sales");
  });

  it("regenerate bumps the version", async () => {
    const state = { id: "doc2", version: 1, category: "sales", renderedHtml: "<x>", contentJson: {} };
    const prisma = {
      document: {
        findUnique: vi.fn(async () => state),
        update: vi.fn(async ({ data }) => { Object.assign(state, data); return { ...state }; }),
      },
    };
    const fill = vi.fn(async () => ({ data: { title: "v2", html: "<h1>v2</h1>" }, model: "gpt-4o", usage: {}, cost: {} }));
    const out = await regenerateCollateral("doc2", { message: "punchier", context: {} }, { prisma, fill });
    expect(out.ok).toBe(true);
    expect(state.version).toBe(2);
  });
});

describe("collateral templates (upload + categories)", () => {
  it("createTemplate stores an uploaded marketing/sales template", async () => {
    const created = [];
    const prisma = { collateralTemplate: { create: vi.fn(async (a) => { created.push(a.data); return { id: "tpl1", ...a.data }; }) } };
    const out = await createTemplate({ tenantId: "t1", title: "ROI one-pager", category: "sales", html: "<html></html>" }, { prisma });
    expect(out.ok).toBe(true);
    expect(created[0]).toMatchObject({ category: "sales", source: "uploaded" });
  });
  it("createTemplate requires html", async () => {
    const out = await createTemplate({ tenantId: "t1", title: "x" }, { prisma: { collateralTemplate: { create: vi.fn() } } });
    expect(out).toMatchObject({ ok: false, reason: "html_required" });
  });
  it("listTemplates merges built-in + custom", async () => {
    const prisma = { collateralTemplate: { findMany: vi.fn(async () => [{ id: "tpl1", title: "Battlecard", category: "sales", source: "uploaded" }]) } };
    const out = await listTemplates({ tenantId: "t1" }, { prisma });
    expect(out.builtin.length).toBeGreaterThan(0);
    expect(out.custom[0].category).toBe("sales");
  });
});
