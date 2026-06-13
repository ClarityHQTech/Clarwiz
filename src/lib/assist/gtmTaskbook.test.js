import { describe, expect, it } from "vitest";
import { mapGtmTasksByStepKey, parseGtmStepKey } from "@/lib/assist/gtmTaskbook";

describe("parseGtmStepKey", () => {
  it("parses path and step indices", () => {
    expect(parseGtmStepKey("1:2")).toEqual({ pathIndex: 1, stepIndex: 2 });
  });

  it("returns null for invalid keys", () => {
    expect(parseGtmStepKey("bad")).toBeNull();
  });
});

describe("mapGtmTasksByStepKey", () => {
  it("indexes rows by stepKey", () => {
    const map = mapGtmTasksByStepKey([
      {
        id: "t1",
        stepKey: "0:1",
        subject: "Share security docs",
        hubspotTaskId: "hs1",
        status: "created",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
    ]);
    expect(map["0:1"].subject).toBe("Share security docs");
    expect(map["0:1"].hubspotTaskId).toBe("hs1");
  });
});
