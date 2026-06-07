import { describe, it, expect } from "vitest";
import { logAssistAction } from "./logAction.js";

describe("logAssistAction", () => {
  it("writes a structured action-log row", async () => {
    let captured;
    const prisma = { assistActionLog: { create: async (a) => ((captured = a), { id: "1" }) } };
    await logAssistAction(prisma, {
      tenantId: "t1",
      actorUserId: "u1",
      entityType: "deal",
      hsObjectId: "D1",
      action: "NBA_EXECUTED",
      payload: { nbaId: "n1" },
    });
    expect(captured.data).toMatchObject({
      tenantId: "t1",
      actorUserId: "u1",
      entityType: "deal",
      hsObjectId: "D1",
      action: "NBA_EXECUTED",
      payload: { nbaId: "n1" },
    });
  });

  it("is fire-and-forget — a write failure never throws, returns null", async () => {
    const prisma = {
      assistActionLog: {
        create: async () => {
          throw new Error("db down");
        },
      },
    };
    const res = await logAssistAction(prisma, { tenantId: "t1", entityType: "deal", action: "NOTE_ADDED" });
    expect(res).toBeNull();
  });
});
