import { describe, it, expect } from "vitest";
import { redactText, redactDeep } from "@/lib/mofu/redact";

describe("PII redaction (G-8)", () => {
  it("redacts emails and phones in text", () => {
    expect(redactText("ping dana.cole@northwind.com or +1 (415) 555-2671")).toBe("ping [email] or [phone]");
  });
  it("deep-redacts nested structures", () => {
    const out = redactDeep({ contacts: [{ email: "a@b.com", note: "call 415-555-2671" }], n: 5 });
    expect(out.contacts[0].email).toBe("[email]");
    expect(out.contacts[0].note).toContain("[phone]");
    expect(out.n).toBe(5);
  });
  it("leaves non-PII untouched", () => {
    expect(redactText("EU data residency required")).toBe("EU data residency required");
  });
});
