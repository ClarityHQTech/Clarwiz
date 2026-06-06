import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifySlackSignature, parseSlashCommand, buildDealNbaResponse, parseSlackAction } from "@/lib/mofu/slack";

function sign(secret, timestamp, body) {
  return "v0=" + crypto.createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex");
}

describe("slack (US-11.1)", () => {
  it("verifies a valid signature and rejects a tampered one", () => {
    const secret = "shh";
    const ts = Math.floor(Date.now() / 1000).toString();
    const body = "text=deal+Acme";
    const sig = sign(secret, ts, body);
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, rawBody: body, signature: sig })).toBe(true);
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, rawBody: body, signature: "v0=bad" })).toBe(false);
  });

  it("rejects a replayed (stale) timestamp", () => {
    const secret = "shh";
    const ts = "1000000000"; // far in the past
    const body = "x=1";
    const sig = sign(secret, ts, body);
    expect(verifySlackSignature({ signingSecret: secret, timestamp: ts, rawBody: body, signature: sig })).toBe(false);
  });

  it("parses slash command text", () => {
    expect(parseSlashCommand("deal Acme Corp")).toEqual({ command: "deal", arg: "Acme Corp" });
  });

  it("parses an interactive block action", () => {
    const payload = { team: { id: "T123" }, actions: [{ action_id: "approve_rec_9", value: "rec_9" }] };
    expect(parseSlackAction(payload)).toEqual({ actionId: "approve_rec_9", value: "rec_9", teamId: "T123" });
    expect(parseSlackAction({})).toBeNull();
  });

  it("builds NBA blocks with Approve only on executable cards", () => {
    const res = buildDealNbaResponse({
      dealName: "Acme",
      cards: [
        { id: "r1", title: "Email", actionType: "SEND_EMAIL", score: 0.9, gate: { executable: true } },
        { id: "r2", title: "Call", actionType: "CALL_WITH_SCRIPT", score: 0.5, gate: { executable: false, cta: "Connect CALLING to HubSpot" } },
      ],
    });
    const approveBtns = JSON.stringify(res.blocks).match(/approve_/g) || [];
    expect(approveBtns.length).toBe(1); // only the executable card has a button
    expect(JSON.stringify(res.blocks)).toContain("Connect CALLING to HubSpot");
  });
});
