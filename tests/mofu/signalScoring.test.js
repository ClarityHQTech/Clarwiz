import { describe, it, expect } from "vitest";
import { scoreSignal, TYPE_WEIGHTS } from "@/lib/mofu/signalScoring";

const now = new Date("2026-06-06T00:00:00Z");

describe("scoreSignal (US-2.1)", () => {
  it("is deterministic for identical inputs", () => {
    const a = scoreSignal({ kind: "CALL_TRANSCRIPT", occurredAt: "2026-06-05T00:00:00Z", now });
    const b = scoreSignal({ kind: "CALL_TRANSCRIPT", occurredAt: "2026-06-05T00:00:00Z", now });
    expect(a).toBe(b);
  });

  it("recent transcript outscores an old note", () => {
    const recent = scoreSignal({ kind: "CALL_TRANSCRIPT", occurredAt: "2026-06-05T00:00:00Z", now });
    const old = scoreSignal({ kind: "NOTE", occurredAt: "2026-04-01T00:00:00Z", now });
    expect(recent).toBeGreaterThan(old);
  });

  it("positive intent hints raise the score", () => {
    const base = scoreSignal({ kind: "EMAIL", occurredAt: "2026-06-05T00:00:00Z", now });
    const hot = scoreSignal({
      kind: "EMAIL",
      occurredAt: "2026-06-05T00:00:00Z",
      now,
      intentHints: ["pricing", "contract"],
    });
    expect(hot).toBeGreaterThan(base);
  });

  it("knows the closed kind weights", () => {
    expect(Object.keys(TYPE_WEIGHTS).sort()).toEqual([
      "CALL_TRANSCRIPT",
      "EMAIL",
      "MEETING",
      "NOTE",
      "STAGE_CHANGE",
    ]);
  });
});
