import { describe, it, expect, vi } from "vitest";
import { pickRecipient, generateActionDraft } from "@/lib/mofu/draftGenerator";

const contacts = [
  { id: "c1", name: "Dana Cole", email: "dana@x.com", persona: "DECISION_MAKER" },
  { id: "c2", name: "Brian Halligan", email: "bh@x.com", persona: "OTHER" },
];

describe("draftGenerator", () => {
  it("picks a recipient named in the action title", () => {
    const r = pickRecipient({ title: "Send collateral to Brian Halligan" }, contacts);
    expect(r).toMatchObject({ id: "c2", email: "bh@x.com" });
  });
  it("falls back to a decision-maker, then first contact", () => {
    expect(pickRecipient({ title: "Follow up" }, contacts).id).toBe("c1");
    expect(pickRecipient({ title: "Follow up" }, [{ id: "c9", name: "Sam", persona: "OTHER" }]).id).toBe("c9");
  });
  it("returns null when there are no contacts", () => {
    expect(pickRecipient({ title: "x" }, [])).toBeNull();
  });
  it("generates a draft via the injected LLM call", async () => {
    const call = vi.fn(async () => ({ data: { subject: "Re: residency", body: "Hi Dana, ..." } }));
    const out = await generateActionDraft(
      { deal: { name: "Acme" }, company: { name: "Acme" }, recipient: contacts[0], rec: { actionType: "SEND_EMAIL", title: "Follow up", payload: { rationale: "pricing" } }, signals: [] },
      { call }
    );
    expect(out).toEqual({ subject: "Re: residency", body: "Hi Dana, ..." });
    expect(call).toHaveBeenCalledOnce();
  });
});
