import { describe, it, expect, vi } from "vitest";
import { ingestSignal } from "@/lib/mofu/ingestSignal";

function fakePrisma() {
  return {
    dealSignal: {
      upsert: vi.fn(async (a) => ({ id: "sig_1", ...a.create })),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };
}

describe("ingestSignal (US-2.1)", () => {
  it("upserts a scored signal with a derived reference id", async () => {
    const prisma = fakePrisma();
    const out = await ingestSignal(
      {
        tenantId: "t1",
        dealId: "deal_1",
        kind: "CALL_TRANSCRIPT",
        source: "hubspot",
        externalId: "call_99",
        summary: "Discovery call",
        occurredAt: "2026-06-05T00:00:00Z",
      },
      { prisma, now: new Date("2026-06-06T00:00:00Z") }
    );
    expect(out.ok).toBe(true);
    expect(prisma.dealSignal.upsert).toHaveBeenCalledTimes(1);
    expect(out.signal.signalReferenceId).toBe("hubspot:CALL_TRANSCRIPT:call_99");
    expect(out.signal.score).toBeGreaterThan(0);
  });

  it("is idempotent — dedupes on the compound unique key", async () => {
    const prisma = fakePrisma();
    const input = { tenantId: "t1", dealId: "deal_1", kind: "EMAIL", source: "hubspot", externalId: "e1" };
    await ingestSignal(input, { prisma });
    await ingestSignal(input, { prisma });
    const wheres = prisma.dealSignal.upsert.mock.calls.map((c) => c[0].where);
    expect(wheres[0]).toEqual(wheres[1]); // same unique selector -> upsert dedupes
  });

  it("skips malformed payload without throwing", async () => {
    const prisma = fakePrisma();
    const out = await ingestSignal({ tenantId: "t1", dealId: "deal_1", kind: "EMAIL" }, { prisma });
    expect(out).toMatchObject({ ok: false, skipped: true, reason: "malformed" });
    expect(prisma.dealSignal.upsert).not.toHaveBeenCalled();
  });

  it("prunes older signals beyond the per-kind cap", async () => {
    const prisma = fakePrisma();
    prisma.dealSignal.count = vi.fn(async () => 26);
    prisma.dealSignal.findMany = vi.fn(async () => [{ id: "old_1" }]);
    await ingestSignal(
      { tenantId: "t1", dealId: "deal_1", kind: "NOTE", source: "hubspot", externalId: "n_new" },
      { prisma }
    );
    expect(prisma.dealSignal.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["old_1"] } } });
  });
});
