import { describe, it, expect, vi } from "vitest";
import {
  buildDealAssociationsUrl,
  stripHtml,
  fetchDealMeetingNotes,
} from "./hubspotRead.js";

describe("buildDealAssociationsUrl", () => {
  it("builds the associations endpoint for a given object type", () => {
    expect(buildDealAssociationsUrl("D1", "meetings")).toBe(
      "/crm/v3/objects/deals/D1/associations/meetings"
    );
    expect(buildDealAssociationsUrl("D2", "notes")).toBe(
      "/crm/v3/objects/deals/D2/associations/notes"
    );
  });
});

describe("stripHtml", () => {
  it("strips tags and decodes basic entities to plain text", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
    expect(stripHtml("a<br>b<br/>c")).toBe("a\nb\nc");
    expect(stripHtml("Tom &amp; Jerry &lt;ok&gt; &nbsp;done")).toBe(
      "Tom & Jerry <ok> done"
    );
  });
  it("returns empty string for nullish input", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
  });
});

// Build a fetch stub that maps URL substrings to responses.
function makeFetch(routes) {
  return vi.fn(async (url) => {
    for (const [match, resp] of routes) {
      if (url.includes(match)) {
        return {
          ok: resp.status ? resp.status < 400 : true,
          status: resp.status ?? 200,
          json: async () => resp.body ?? {},
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

describe("fetchDealMeetingNotes", () => {
  it("concatenates meetings + notes newest-first with headers", async () => {
    const fetchImpl = makeFetch([
      [
        "/associations/meetings",
        { body: { results: [{ toObjectId: "M1" }, { toObjectId: "M2" }] } },
      ],
      ["/associations/notes", { body: { results: [{ toObjectId: "N1" }] } }],
      [
        "/meetings/batch/read",
        {
          body: {
            results: [
              {
                id: "M1",
                properties: {
                  hs_meeting_title: "Discovery",
                  hs_meeting_body: "<p>Talked budget</p>",
                  hs_timestamp: "2026-01-02T00:00:00Z",
                },
              },
              {
                id: "M2",
                properties: {
                  hs_meeting_title: "Demo",
                  hs_meeting_body: "Showed product",
                  hs_internal_meeting_notes: "<p>Internal: champion engaged</p>",
                  hs_timestamp: "2026-01-05T00:00:00Z",
                },
              },
            ],
          },
        },
      ],
      [
        "/notes/batch/read",
        {
          body: {
            results: [
              {
                id: "N1",
                properties: {
                  hs_note_body: "<div>Note-taker: next steps agreed</div>",
                  hs_timestamp: "2026-01-04T00:00:00Z",
                },
              },
            ],
          },
        },
      ],
    ]);

    const res = await fetchDealMeetingNotes("tok", "D1", { fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.sources).toHaveLength(3);
    // newest-first: Demo (01-05) > Note (01-04) > Discovery (01-02)
    expect(res.sources[0].body).toContain("Showed product");
    expect(res.sources[0].body).toContain("champion engaged");
    expect(res.sources[1].type).toBe("note");
    expect(res.sources[2].title).toBe("Discovery");
    // text headers + ordering
    const demoIdx = res.text.indexOf("Demo");
    const discoIdx = res.text.indexOf("Discovery");
    expect(demoIdx).toBeGreaterThanOrEqual(0);
    expect(demoIdx).toBeLessThan(discoIdx);
    expect(res.text).toContain("## Demo");
    // HTML stripped
    expect(res.text).not.toContain("<p>");
    expect(res.text).not.toContain("<div>");
  });

  it("returns empty result on 403 without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = makeFetch([
      ["/associations/meetings", { status: 403, body: {} }],
      ["/associations/notes", { status: 403, body: {} }],
    ]);
    const res = await fetchDealMeetingNotes("tok", "D1", { fetchImpl });
    expect(res).toEqual({ ok: false, text: "", sources: [] });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns empty result when no associations exist", async () => {
    const fetchImpl = makeFetch([
      ["/associations/meetings", { body: { results: [] } }],
      ["/associations/notes", { body: { results: [] } }],
    ]);
    const res = await fetchDealMeetingNotes("tok", "D1", { fetchImpl });
    expect(res).toEqual({ ok: false, text: "", sources: [] });
  });

  it("never throws on network error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new Error("boom");
    });
    const res = await fetchDealMeetingNotes("tok", "D1", { fetchImpl });
    expect(res).toEqual({ ok: false, text: "", sources: [] });
    warn.mockRestore();
  });

  it("returns empty when hubspotDealId is missing", async () => {
    const fetchImpl = vi.fn();
    const res = await fetchDealMeetingNotes("tok", null, { fetchImpl });
    expect(res).toEqual({ ok: false, text: "", sources: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
