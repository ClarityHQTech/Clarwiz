import { describe, it, expect } from "vitest";
import {
  availableProspectChannels,
  enforceChannelRules,
  hasProspectChannelDetail,
  isExecutableProspectChannel,
  resolveExecutableProspectChannels,
} from "./executionRules.js";

describe("hasProspectChannelDetail", () => {
  it("requires trimmed contact values", () => {
    expect(hasProspectChannelDetail({ email: "  " }, "email")).toBe(false);
    expect(hasProspectChannelDetail({ email: "a@b.com" }, "email")).toBe(true);
    expect(
      hasProspectChannelDetail({ linkedinUrl: "https://linkedin.com/in/x" }, "linkedin")
    ).toBe(true);
    expect(hasProspectChannelDetail({ whatsapp: "+15551212" }, "whatsapp")).toBe(
      true
    );
  });
});

describe("availableProspectChannels", () => {
  it("only returns enabled channels with contact details", () => {
    const prospect = {
      email: "a@b.com",
      linkedinUrl: "https://linkedin.com/in/x",
      whatsapp: null,
    };
    expect(
      availableProspectChannels(prospect, ["linkedin", "whatsapp"])
    ).toEqual(["linkedin"]);
  });
});

describe("resolveExecutableProspectChannels", () => {
  it("respects campaign enabled channels and contact details", () => {
    const campaign = { enabledChannels: ["linkedin", "whatsapp"] };
    const prospect = { linkedinUrl: "https://linkedin.com/in/x" };
    expect(resolveExecutableProspectChannels(campaign, prospect)).toEqual([
      "linkedin",
    ]);
    expect(
      isExecutableProspectChannel(campaign, prospect, "email")
    ).toBe(false);
  });
});

describe("enforceChannelRules", () => {
  const prospectChannels = ["linkedin", "whatsapp"];

  it("remaps disabled email to an enabled channel with contact details", () => {
    const result = enforceChannelRules(
      { channel: "email", message: "hi", skip: false },
      prospectChannels,
      [],
      ["linkedin", "whatsapp"]
    );
    expect(result.skip).toBe(false);
    expect(result.channel).toBe("linkedin");
  });

  it("skips when no executable channels exist", () => {
    const result = enforceChannelRules(
      { channel: "email", message: "hi", skip: false },
      [],
      [],
      ["linkedin"]
    );
    expect(result.skip).toBe(true);
    expect(result.skipReason).toMatch(/No contact channels available/);
  });
});
