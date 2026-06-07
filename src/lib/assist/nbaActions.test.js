import { describe, it, expect } from "vitest";
import {
  classifyNbaAction,
  MEETING_KEYWORDS,
  POST_MEETING_KEYWORDS,
  TASK_KEYWORDS,
  COLLATERAL_KEYWORDS,
} from "./nbaActions.js";

describe("classifyNbaAction", () => {
  it("classifies schedule_meeting actionType as a meeting", () => {
    const r = classifyNbaAction({ actionType: "schedule_meeting", title: "Set up a sync" });
    expect(r.kind).toBe("meeting");
    expect(r.postMeeting).toBe(false);
  });

  it("classifies a Sales::Demo verb as a meeting even when actionType is generic", () => {
    const r = classifyNbaAction({ actionType: "create_task", actionVerb: "Sales::Demo", title: "Run product demo" });
    expect(r.kind).toBe("meeting");
  });

  it("classifies CustomerSuccess::Health_Check verb as a meeting", () => {
    const r = classifyNbaAction({ actionVerb: "CustomerSuccess::Health_Check", title: "Schedule health check" });
    expect(r.kind).toBe("meeting");
  });

  it("classifies a QBR title as a meeting", () => {
    const r = classifyNbaAction({ actionType: "draft_email", actionVerb: "CustomerSuccess::QBR", title: "Book the QBR" });
    expect(r.kind).toBe("meeting");
  });

  it("classifies a plain draft_email as an email", () => {
    const r = classifyNbaAction({ actionType: "draft_email", title: "Send pricing follow-up" });
    expect(r.kind).toBe("email");
    expect(r.postMeeting).toBe(false);
  });

  it("flags a post-meeting recap email with postMeeting:true", () => {
    const r = classifyNbaAction({ actionType: "draft_email", title: "Follow up after the demo" });
    expect(r.kind).toBe("email");
    expect(r.postMeeting).toBe(true);
  });

  it("treats a recap email as post-meeting even though it mentions 'demo' (meeting kw)", () => {
    const r = classifyNbaAction({ actionType: "draft_email", title: "Recap of the demo and next steps" });
    expect(r.kind).toBe("email");
    expect(r.postMeeting).toBe(true);
  });

  it("classifies send_collateral as collateral", () => {
    const r = classifyNbaAction({ actionType: "send_collateral", title: "Share the ROI one-pager" });
    expect(r.kind).toBe("collateral");
  });

  it("classifies collateral by title keyword when actionType is generic", () => {
    const r = classifyNbaAction({ actionType: "draft_email", title: "Send the case study" });
    expect(r.kind).toBe("collateral");
  });

  it("classifies a create_task without meeting words as a task", () => {
    const r = classifyNbaAction({ actionType: "create_task", title: "Update CRM with new contact" });
    expect(r.kind).toBe("task");
  });

  it("classifies clarify_technical as an email by default", () => {
    const r = classifyNbaAction({ actionType: "clarify_technical", title: "Answer security questionnaire" });
    expect(r.kind).toBe("email");
  });

  it("defaults to email for an empty/unknown NBA", () => {
    expect(classifyNbaAction({}).kind).toBe("email");
    expect(classifyNbaAction(null).kind).toBe("email");
  });

  it("matches a 'call' title as a meeting", () => {
    expect(classifyNbaAction({ title: "Schedule a discovery call" }).kind).toBe("meeting");
  });
});

describe("exported keyword sets", () => {
  it("expose the keyword arrays", () => {
    expect(MEETING_KEYWORDS).toContain("demo");
    expect(MEETING_KEYWORDS).toContain("qbr");
    expect(POST_MEETING_KEYWORDS).toContain("recap");
    expect(TASK_KEYWORDS).toContain("reminder");
    expect(COLLATERAL_KEYWORDS).toContain("case study");
  });
});
