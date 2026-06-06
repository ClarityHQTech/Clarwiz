import { describe, it, expect, vi } from "vitest";
import { listDealDocuments, getDocument } from "@/lib/mofu/documents";

describe("documents", () => {
  it("lists and serializes deal documents", async () => {
    const prisma = {
      document: {
        findMany: vi.fn(async () => [
          { id: "d1", type: "SALES_COLLATERAL", path: "B", status: "READY", version: 2, contentJson: { asset: { title: "Battlecard" }, stage: "ready", trace: [] }, renderedHtml: "<h1>x</h1>", createdAt: new Date(), updatedAt: new Date() },
        ]),
      },
    };
    const out = await listDealDocuments({ tenantId: "t1", dealId: "deal_1" }, { prisma });
    expect(out[0]).toMatchObject({ id: "d1", path: "B", version: 2, title: "Battlecard", hasHtml: true });
  });

  it("getDocument returns content + html, or not_found", async () => {
    const prisma = { document: { findFirst: vi.fn(async () => null) } };
    expect(await getDocument({ tenantId: "t1", documentId: "x" }, { prisma })).toMatchObject({ ok: false, reason: "not_found" });
  });
});
