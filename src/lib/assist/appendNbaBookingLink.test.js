import { describe, it, expect } from "vitest";
import {
  buildAssistTrackedBookingUrl,
  appendAssistBookingLink,
} from "./appendNbaBookingLink.js";

describe("buildAssistTrackedBookingUrl", () => {
  it("builds a deal-scoped book URL with optional nbaId", () => {
    expect(buildAssistTrackedBookingUrl("d1")).toContain("/api/assist/deal/d1/book");
    expect(buildAssistTrackedBookingUrl("d1", { nbaId: "n1" })).toContain("nbaId=n1");
  });
});

describe("appendAssistBookingLink", () => {
  it("appends a tracked scheduling link when none is present", () => {
    const html = "<p>Hello there</p>";
    const out = appendAssistBookingLink({
      html,
      calendlyBookingUrl: "https://calendly.com/acme/30min",
      dealId: "d1",
      nbaId: "n1",
    });
    expect(out).toContain("Schedule a meeting");
    expect(out).toContain("/api/assist/deal/d1/book?nbaId=n1");
  });

  it("adds a tracked link when the draft mentions scheduling", () => {
    const html = "<p>Happy to find time this week if helpful.</p>";
    const out = appendAssistBookingLink({
      html,
      calendlyBookingUrl: "https://calendly.com/acme/30min",
      dealId: "d1",
      nbaId: "n1",
    });
    expect(out).toContain("/api/assist/deal/d1/book?nbaId=n1");
    expect(out).toContain("Schedule a meeting");
  });

  it("returns html unchanged when calendly URL is missing", () => {
    const html = "<p>Hi</p>";
    expect(appendAssistBookingLink({ html, calendlyBookingUrl: null, dealId: "d1" })).toBe(html);
  });
});
