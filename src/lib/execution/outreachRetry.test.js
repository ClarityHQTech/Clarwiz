import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MAX_OUTREACH_RETRIES,
  scheduleOutreachRetry,
  nextRetryDelayMs,
} from "./outreachRetry.js";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    communicationLog: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("outreachRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps retries at MAX_OUTREACH_RETRIES", async () => {
    const result = await scheduleOutreachRetry("log-1", {
      error: "network",
      retryCount: MAX_OUTREACH_RETRIES,
    });
    expect(result.exhausted).toBe(true);
    expect(prisma.communicationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log-1" },
        data: expect.objectContaining({ status: "failed" }),
      })
    );
  });

  it("schedules retry while under the cap", async () => {
    const result = await scheduleOutreachRetry("log-2", {
      error: "timeout",
      retryCount: 1,
    });
    expect(result.exhausted).toBe(false);
    expect(result.retryCount).toBe(2);
    expect(prisma.communicationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "retry_pending",
          retryCount: 2,
        }),
      })
    );
  });

  it("uses three backoff steps", () => {
    expect(nextRetryDelayMs(0)).toBe(5 * 60_000);
    expect(nextRetryDelayMs(1)).toBe(15 * 60_000);
    expect(nextRetryDelayMs(2)).toBe(60 * 60_000);
    expect(nextRetryDelayMs(99)).toBe(60 * 60_000);
  });
});
