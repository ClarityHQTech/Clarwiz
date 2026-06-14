import { describe, it, expect } from "vitest";
import { runWithConcurrency } from "./outreachDispatch.js";

describe("runWithConcurrency", () => {
  it("runs all items with a concurrency cap", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5];

    await runWithConcurrency(items, 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return n * 2;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
