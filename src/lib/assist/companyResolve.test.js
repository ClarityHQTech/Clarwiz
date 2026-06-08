import { describe, it, expect } from "vitest";
import {
  domainFromEmail,
  FREE_MAIL_DOMAINS,
  resolveCompanyForContact,
} from "./companyResolve.js";

describe("domainFromEmail", () => {
  it("returns the lowercased registrable domain for a business email", () => {
    expect(domainFromEmail("Bea.Buyer@Acme.com")).toBe("acme.com");
  });

  it("strips a subdomain to the registrable domain (best-effort)", () => {
    expect(domainFromEmail("user@mail.acme.com")).toBe("acme.com");
    expect(domainFromEmail("user@sales.eu.acme.com")).toBe("acme.com");
  });

  it("keeps two-label public-suffix domains intact", () => {
    expect(domainFromEmail("user@acme.co.uk")).toBe("acme.co.uk");
    expect(domainFromEmail("user@team.acme.co.uk")).toBe("acme.co.uk");
  });

  it("returns null for free-mail providers", () => {
    for (const d of ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com", "proton.me"]) {
      expect(domainFromEmail(`someone@${d}`)).toBeNull();
    }
  });

  it("exports the free-mail set and treats it case-insensitively", () => {
    expect(FREE_MAIL_DOMAINS.has("gmail.com")).toBe(true);
    expect(domainFromEmail("Someone@GMAIL.com")).toBeNull();
  });

  it("returns null for empty / malformed input", () => {
    expect(domainFromEmail(null)).toBeNull();
    expect(domainFromEmail("")).toBeNull();
    expect(domainFromEmail("no-at-sign")).toBeNull();
    expect(domainFromEmail("trailing@")).toBeNull();
  });
});

// ── Minimal in-memory Prisma stub for resolveCompanyForContact ──────────────
function makeStub({ companies = [], accounts = [] } = {}) {
  let cid = companies.length;
  let aid = accounts.length;
  const matchWhere = (row, where) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    _companies: companies,
    _accounts: accounts,
    company: {
      findFirst: async ({ where }) =>
        companies.find((c) => matchWhere(c, where)) ?? null,
      create: async ({ data }) => {
        const row = { id: `co${++cid}`, ...data };
        companies.push(row);
        return row;
      },
    },
    account: {
      findFirst: async ({ where }) =>
        accounts.find((a) => matchWhere(a, where)) ?? null,
      create: async ({ data }) => {
        const row = { id: `ac${++aid}`, ...data };
        accounts.push(row);
        return row;
      },
    },
  };
}

describe("resolveCompanyForContact", () => {
  it("reuses an existing Company matched by domain", async () => {
    const prisma = makeStub({
      companies: [{ id: "co1", name: "Acme Inc", domain: "acme.com" }],
    });
    const res = await resolveCompanyForContact(prisma, "t1", { email: "bea@acme.com" });
    expect(res.companyId).toBe("co1");
    expect(prisma._companies).toHaveLength(1); // no duplicate company
    expect(res.accountId).toBeTruthy();
  });

  it("creates a Company + Account when none exists", async () => {
    const prisma = makeStub();
    const res = await resolveCompanyForContact(prisma, "t1", {
      email: "lead@newco.com",
      companyName: "NewCo",
    });
    expect(prisma._companies).toHaveLength(1);
    expect(prisma._companies[0]).toMatchObject({ name: "NewCo", domain: "newco.com" });
    expect(prisma._accounts).toHaveLength(1);
    expect(prisma._accounts[0]).toMatchObject({ tenantId: "t1", companyId: res.companyId });
  });

  it("falls back to the domain as the company name when no companyName is given", async () => {
    const prisma = makeStub();
    const res = await resolveCompanyForContact(prisma, "t1", { email: "lead@newco.com" });
    expect(prisma._companies[0]).toMatchObject({ name: "newco.com", domain: "newco.com" });
    expect(res.companyId).toBe(prisma._companies[0].id);
  });

  it("returns null for free-mail / non-resolvable domains and writes nothing", async () => {
    const prisma = makeStub();
    expect(await resolveCompanyForContact(prisma, "t1", { email: "me@gmail.com" })).toBeNull();
    expect(await resolveCompanyForContact(prisma, "t1", { email: "garbage" })).toBeNull();
    expect(await resolveCompanyForContact(prisma, "t1", {})).toBeNull();
    expect(prisma._companies).toHaveLength(0);
    expect(prisma._accounts).toHaveLength(0);
  });

  it("links two contacts from the same domain to the same Company + Account", async () => {
    const prisma = makeStub();
    const a = await resolveCompanyForContact(prisma, "t1", { email: "alice@shared.com" });
    const b = await resolveCompanyForContact(prisma, "t1", { email: "bob@mail.shared.com" });
    expect(a.companyId).toBe(b.companyId);
    expect(a.accountId).toBe(b.accountId);
    expect(prisma._companies).toHaveLength(1);
    expect(prisma._accounts).toHaveLength(1);
  });

  it("shares the global Company across tenants but gives each tenant its own Account", async () => {
    const prisma = makeStub();
    const t1 = await resolveCompanyForContact(prisma, "t1", { email: "a@shared.com" });
    const t2 = await resolveCompanyForContact(prisma, "t2", { email: "b@shared.com" });
    expect(t1.companyId).toBe(t2.companyId); // global Company deduped by domain
    expect(t1.accountId).not.toBe(t2.accountId); // per-tenant Account
    expect(prisma._companies).toHaveLength(1);
    expect(prisma._accounts).toHaveLength(2);
  });

  it("matches an existing Company by name when domain has no match", async () => {
    const prisma = makeStub({
      companies: [{ id: "co1", name: "Acme Inc", domain: null }],
    });
    const res = await resolveCompanyForContact(prisma, "t1", {
      email: "x@acme.com",
      companyName: "Acme Inc",
    });
    expect(res.companyId).toBe("co1");
    expect(prisma._companies).toHaveLength(1);
  });
});
