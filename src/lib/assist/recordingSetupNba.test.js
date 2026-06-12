import { describe, it, expect } from "vitest";
import {
  isPastHubspotMeeting,
  meetingLacksRecorderNotes,
  dealNeedsMeetingRecorderSetup,
  SETUP_RECORDING_VERB,
  ensureRecordingSetupNbaForDeal,
} from "./recordingSetupNba.js";

describe("isPastHubspotMeeting", () => {
  it("returns false for calls and future meetings", () => {
    expect(isPastHubspotMeeting({ engagementType: "call" })).toBe(false);
    expect(
      isPastHubspotMeeting({
        engagementType: "meeting",
        payload: { hs_meeting_end_time: Date.now() + 60_000 },
      })
    ).toBe(false);
  });

  it("returns true for completed or past-end meetings", () => {
    expect(
      isPastHubspotMeeting({
        engagementType: "meeting",
        payload: { hs_meeting_outcome: "COMPLETED" },
      })
    ).toBe(true);
    expect(
      isPastHubspotMeeting({
        engagementType: "meeting",
        payload: { hs_meeting_end_time: Date.now() - 60_000 },
      })
    ).toBe(true);
  });
});

describe("meetingLacksRecorderNotes", () => {
  it("flags past meetings with no notes", () => {
    expect(
      meetingLacksRecorderNotes({
        engagementType: "meeting",
        transcriptAvailable: false,
        transcriptText: null,
        payload: { hs_meeting_outcome: "COMPLETED" },
      })
    ).toBe(true);
  });

  it("ignores meetings that have notes", () => {
    expect(
      meetingLacksRecorderNotes({
        engagementType: "meeting",
        transcriptAvailable: true,
        transcriptText: "Discussed pricing",
        payload: { hs_meeting_outcome: "COMPLETED" },
      })
    ).toBe(false);
  });
});

describe("dealNeedsMeetingRecorderSetup", () => {
  it("is true when any past meeting lacks notes", () => {
    expect(
      dealNeedsMeetingRecorderSetup([
        {
          engagementType: "meeting",
          transcriptAvailable: true,
          transcriptText: "ok",
          payload: { hs_meeting_outcome: "COMPLETED" },
        },
        {
          engagementType: "meeting",
          transcriptAvailable: false,
          transcriptText: "",
          payload: { hs_meeting_outcome: "COMPLETED" },
        },
      ])
    ).toBe(true);
  });
});

describe("ensureRecordingSetupNbaForDeal", () => {
  it("creates a setup NBA when a past meeting has no notes", async () => {
    const created = [];
    const prisma = {
      dealRecording: {
        findMany: async () => [
          {
            dealId: "d1",
            engagementType: "meeting",
            transcriptAvailable: false,
            transcriptText: null,
            payload: { hs_meeting_outcome: "COMPLETED" },
            occurredAt: new Date(Date.now() - 3_600_000),
          },
        ],
      },
      nbaRecommendation: {
        findFirst: async () => null,
        create: async ({ data }) => {
          created.push(data);
          return { id: "n1", ...data };
        },
      },
    };

    const ok = await ensureRecordingSetupNbaForDeal(prisma, "t1", "d1");
    expect(ok).toBe(true);
    expect(created[0]).toMatchObject({
      actionVerb: SETUP_RECORDING_VERB,
      actionType: "create_task",
      dealId: "d1",
    });
  });
});
