import { describe, it, expect } from "vitest";
import {
  buildStageMap,
  mapHsDeal,
  mapHsContact,
  mapHsCompany,
  dedupeAssociations,
  buildOpenDealsSearch,
  buildMqlContactsSearch,
} from "./hubspotMap.js";

const PIPELINES = {
  results: [
    {
      label: "Sales Pipeline",
      stages: [
        { id: "3718224610", label: "Prospecting", displayOrder: 0, metadata: { isClosed: "false" } },
        { id: "3718224611", label: "Qualified Lead", displayOrder: 1, metadata: { isClosed: "false" } },
        { id: "3718224612", label: "Proposal Sent", displayOrder: 2, metadata: { isClosed: "false" } },
        { id: "3718224613", label: "Negotiation", displayOrder: 3, metadata: { isClosed: "false" } },
        { id: "closedwon", label: "Closed Won", displayOrder: 4, metadata: { isClosed: "true", probability: "1.0" } },
        { id: "closedlost", label: "Closed Lost", displayOrder: 5, metadata: { isClosed: "true", probability: "0.0" } },
      ],
    },
  ],
};

describe("buildStageMap", () => {
  const m = buildStageMap(PIPELINES);

  it("bands early open stages EARLY and later open stages LATE", () => {
    expect(m["3718224610"].band).toBe("DEAL_EARLY");
    expect(m["3718224611"].band).toBe("DEAL_EARLY");
    expect(m["3718224612"].band).toBe("DEAL_LATE");
    expect(m["3718224613"].band).toBe("DEAL_LATE");
  });

  it("derives OPEN/WON/LOST status from stage metadata", () => {
    expect(m["3718224611"].status).toBe("OPEN");
    expect(m["closedwon"].status).toBe("WON");
    expect(m["closedlost"].status).toBe("LOST");
  });

  it("keeps the human label", () => {
    expect(m["3718224612"].label).toBe("Proposal Sent");
  });
});

describe("mapHsDeal", () => {
  const stageMap = buildStageMap(PIPELINES);
  const hsDeal = {
    id: "326239164100",
    properties: {
      dealname: "Northwind Traders — Analytics Platform",
      amount: "84000",
      dealstage: "3718224612",
      hubspot_owner_id: "92756177",
      hs_lastmodifieddate: "2026-06-07T00:32:50.899Z",
    },
  };

  it("maps HubSpot deal → graph shape with band/status/amount", () => {
    const d = mapHsDeal(hsDeal, stageMap);
    expect(d.hubspotDealId).toBe("326239164100");
    expect(d.name).toBe("Northwind Traders — Analytics Platform");
    expect(d.amount).toBe(84000);
    expect(d.stageLabel).toBe("Proposal Sent");
    expect(d.stageBand).toBe("DEAL_LATE");
    expect(d.status).toBe("OPEN");
    expect(d.ownerId).toBe("92756177");
    expect(d.lastActivityAt).toBeInstanceOf(Date);
  });

  it("tolerates unknown stage and missing amount", () => {
    const d = mapHsDeal({ id: "1", properties: { dealname: "X", dealstage: "zzz" } }, stageMap);
    expect(d.amount).toBeNull();
    expect(d.stageBand).toBeNull();
    expect(d.status).toBe("OPEN");
  });
});

describe("mapHsContact", () => {
  it("maps properties and composes a name", () => {
    const c = mapHsContact({
      id: "490160112336",
      properties: {
        email: "Rakesh.Waths@kewalkiran.com",
        firstname: "Rakesh",
        lastname: "Waths",
        jobtitle: "National Head of Retail",
        lifecyclestage: "lead",
        hubspot_owner_id: "92756177",
      },
    });
    expect(c.hubspotContactId).toBe("490160112336");
    expect(c.email).toBe("rakesh.waths@kewalkiran.com"); // lowercased for joins
    expect(c.name).toBe("Rakesh Waths");
    expect(c.jobTitle).toBe("National Head of Retail");
    expect(c.ownerId).toBe("92756177");
  });

  it("falls back to email local-part when no name", () => {
    const c = mapHsContact({ id: "1", properties: { email: "jane@acme.com" } });
    expect(c.name).toBe("jane");
  });
});

describe("mapHsCompany", () => {
  it("maps company properties", () => {
    const a = mapHsCompany({
      id: "324070805226",
      properties: { name: "AAFT Online", domain: "aaftonline.com", industry: "CONSUMER_SERVICES" },
    });
    expect(a.hubspotCompanyId).toBe("324070805226");
    expect(a.name).toBe("AAFT Online");
    expect(a.domain).toBe("aaftonline.com");
    expect(a.industry).toBe("CONSUMER_SERVICES");
  });
});

describe("dedupeAssociations", () => {
  it("dedupes repeated association ids", () => {
    const assoc = {
      companies: { results: [{ id: "a" }, { id: "a" }, { id: "b" }] },
      contacts: { results: [{ id: "c" }] },
    };
    const out = dedupeAssociations(assoc);
    expect(out.companies).toEqual(["a", "b"]);
    expect(out.contacts).toEqual(["c"]);
  });

  it("returns empty arrays when associations absent", () => {
    expect(dedupeAssociations(undefined)).toEqual({ companies: [], contacts: [] });
  });
});

describe("search body builders", () => {
  it("builds an open-deals search (hs_is_closed=false) with optional owner filter", () => {
    const body = buildOpenDealsSearch({ ownerId: "92756177", limit: 100 });
    const filters = body.filterGroups[0].filters;
    expect(filters).toContainEqual({ propertyName: "hs_is_closed", operator: "EQ", value: "false" });
    expect(filters).toContainEqual({ propertyName: "hubspot_owner_id", operator: "EQ", value: "92756177" });
    expect(body.limit).toBe(100);
    expect(body.properties).toContain("dealname");
  });

  it("omits the owner filter when no owner is given", () => {
    const body = buildOpenDealsSearch({});
    expect(body.filterGroups[0].filters).toHaveLength(1);
  });

  it("builds an MQL contacts search", () => {
    const body = buildMqlContactsSearch({});
    expect(body.filterGroups[0].filters).toContainEqual({
      propertyName: "lifecyclestage",
      operator: "EQ",
      value: "marketingqualifiedlead",
    });
  });
});
