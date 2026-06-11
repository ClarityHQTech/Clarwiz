import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertContact } from "./syncGraph.js";

const TENANT = "tenant-1";

function mockPrisma({ contacts = [], businessUsers = [] } = {}) {
  const store = [...contacts];
  const buStore = [...businessUsers];

  return {
    businessUser: {
      findFirst: vi.fn(async ({ where }) => buStore.find((b) => b.email === where.email) ?? null),
      create: vi.fn(async ({ data }) => {
        const row = { id: `bu_${buStore.length + 1}`, companyId: null, ...data };
        buStore.push(row);
        return row;
      }),
    },
    contact: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.tenantId_hubspotContactId) {
          const { tenantId, hubspotContactId } = where.tenantId_hubspotContactId;
          return store.find((c) => c.tenantId === tenantId && c.hubspotContactId === hubspotContactId) ?? null;
        }
        if (where.tenantId_businessUserId) {
          const { tenantId, businessUserId } = where.tenantId_businessUserId;
          return store.find((c) => c.tenantId === tenantId && c.businessUserId === businessUserId) ?? null;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const idx = store.findIndex((c) => c.id === where.id);
        if (idx < 0) throw new Error("not found");
        const conflictHs =
          data.hubspotContactId &&
          store.some(
            (c, i) => i !== idx && c.tenantId === store[idx].tenantId && c.hubspotContactId === data.hubspotContactId
          );
        if (conflictHs) {
          const err = new Error("Unique constraint");
          err.code = "P2002";
          throw err;
        }
        store[idx] = { ...store[idx], ...data };
        return store[idx];
      }),
      create: vi.fn(async ({ data }) => {
        const conflictHs =
          data.hubspotContactId &&
          store.some((c) => c.tenantId === data.tenantId && c.hubspotContactId === data.hubspotContactId);
        const conflictBu = store.some(
          (c) => c.tenantId === data.tenantId && c.businessUserId === data.businessUserId
        );
        if (conflictHs || conflictBu) {
          const err = new Error("Unique constraint");
          err.code = "P2002";
          throw err;
        }
        const row = { id: `ct_${store.length + 1}`, ...data };
        store.push(row);
        return row;
      }),
    },
    _store: store,
    _buStore: buStore,
  };
}

describe("upsertContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the existing row by hubspotContactId when email maps to a different BusinessUser", async () => {
    const prisma = mockPrisma({
      businessUsers: [{ id: "bu_old", email: "old@acme.test" }],
      contacts: [{ id: "ct_1", tenantId: TENANT, businessUserId: "bu_old", hubspotContactId: "HS-1" }],
    });
    prisma.businessUser.findFirst.mockImplementation(async ({ where }) => {
      if (where.email === "new@acme.test") return { id: "bu_new", email: "new@acme.test", companyId: null };
      return null;
    });

    const row = await upsertContact(prisma, TENANT, {
      id: "HS-1",
      properties: { email: "new@acme.test", firstname: "N", lastname: "New", lifecyclestage: "lead" },
    });

    expect(row.id).toBe("ct_1");
    expect(row.hubspotContactId).toBe("HS-1");
    expect(prisma.contact.create).not.toHaveBeenCalled();
  });

  it("attaches hubspotContactId to an existing TOFU contact matched by businessUserId", async () => {
    const prisma = mockPrisma({
      businessUsers: [{ id: "bu_1", email: "buyer@acme.test" }],
      contacts: [{ id: "ct_tofu", tenantId: TENANT, businessUserId: "bu_1", hubspotContactId: null }],
    });
    prisma.businessUser.findFirst.mockResolvedValue({ id: "bu_1", email: "buyer@acme.test", companyId: null });

    const row = await upsertContact(prisma, TENANT, {
      id: "HS-9",
      properties: { email: "buyer@acme.test", firstname: "B", lastname: "Buyer", lifecyclestage: "lead" },
    });

    expect(row.id).toBe("ct_tofu");
    expect(row.hubspotContactId).toBe("HS-9");
    expect(prisma.contact.create).not.toHaveBeenCalled();
  });
});
