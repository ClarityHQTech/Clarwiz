import { describe, it, expect } from "vitest";
import {
  getWhatsAppCopilotUiState,
  resolveWhatsAppSendMode,
} from "./whatsappSessionWindow.js";

const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe("resolveWhatsAppSendMode", () => {
  it("uses template for cold outreach even when the 24h window is open", () => {
    const mode = resolveWhatsAppSendMode({
      decision: {
        templateId: "tpl-1",
        message: "Hello from template",
      },
      prospect: { whatsapp24hWindowExpiresAt: futureExpiry },
      commHistory: [],
    });
    expect(mode).toBe("template");
  });

  it("uses free-form only after a prospect WhatsApp reply", () => {
    const mode = resolveWhatsAppSendMode({
      decision: { templateId: null, message: "Thanks for your reply!" },
      prospect: { whatsapp24hWindowExpiresAt: futureExpiry },
      commHistory: [
        {
          channel: "whatsapp",
          responseType: "reply",
          responseContent: "Sure, tell me more",
          responseAt: new Date().toISOString(),
        },
      ],
    });
    expect(mode).toBe("freeform");
  });

  it("does not use free-form on cold outreach without a template", () => {
    const mode = resolveWhatsAppSendMode({
      decision: { templateId: null, message: "Cold free text" },
      prospect: { whatsapp24hWindowExpiresAt: futureExpiry },
      commHistory: [],
    });
    expect(mode).toBe("none");
  });
});

describe("getWhatsAppCopilotUiState", () => {
  it("disallows free-form when the window is open but there is no prospect reply", () => {
    const state = getWhatsAppCopilotUiState(
      { whatsapp24hWindowExpiresAt: futureExpiry },
      []
    );
    expect(state.windowOpen).toBe(true);
    expect(state.canSendFreeForm).toBe(false);
    expect(state.canSendTemplate).toBe(true);
  });

  it("allows free-form when the prospect has replied and the window is open", () => {
    const state = getWhatsAppCopilotUiState(
      { whatsapp24hWindowExpiresAt: futureExpiry },
      [
        {
          channel: "whatsapp",
          responseType: "reply",
          responseContent: "Hi",
          responseAt: new Date().toISOString(),
        },
      ]
    );
    expect(state.canSendFreeForm).toBe(true);
  });
});
