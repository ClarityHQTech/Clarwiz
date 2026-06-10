import { describe, it, expect } from "vitest";
import { utterancesToText, fetchCallTranscript } from "./hubspotRecordings.js";
import { hasHubspotScope, assessRecordingScopes, HUBSPOT_SCOPES } from "./hubspotScopes.js";

describe("utterancesToText", () => {
  it("formats speaker-labelled dialogue", () => {
    const text = utterancesToText([
      { speaker: { name: "AE" }, text: "Hello" },
      { speaker: { name: "Buyer" }, text: "Hi there" },
    ]);
    expect(text).toContain("AE: Hello");
    expect(text).toContain("Buyer: Hi there");
  });
});

describe("fetchCallTranscript", () => {
  it("returns not_api_accessible on 404", async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const res = await fetchCallTranscript("tok", "tx-1", { fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("not_api_accessible");
  });

  it("returns text on success", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "tx-1",
        transcriptSource: "INTEGRATOR_GENERATED",
        transcriptUtterances: [{ speaker: { name: "A" }, text: "Done" }],
      }),
    });
    const res = await fetchCallTranscript("tok", "tx-1", { fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.text).toBe("A: Done");
  });
});

describe("hubspotScopes", () => {
  it("detects transcript scope", () => {
    expect(hasHubspotScope([HUBSPOT_SCOPES.TRANSCRIPTS_READ], HUBSPOT_SCOPES.TRANSCRIPTS_READ)).toBe(
      true
    );
    expect(assessRecordingScopes([]).hasTranscriptsRead).toBe(false);
  });
});
