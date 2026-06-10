import { normalizeContactPersona } from "@/lib/contactPersona";

function normalizeCompanyName(name) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

/** Multi-part public suffixes (e.g. example.co.uk). */
const TWO_PART_PUBLIC_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "net.uk",
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "co.nz",
  "co.jp",
  "co.in",
  "co.za",
  "com.br",
  "com.mx",
  "com.sg",
  "com.hk",
]);

function extractEmailHost(email) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return null;

  const host = normalized.split("@").pop()?.trim();
  if (!host || !host.includes(".")) return null;

  return host;
}

/** mail.example.com → example.com; example.ai → example.ai; john.tech@example.com uses example.com. */
function getRegistrableDomain(host) {
  const labels = host.trim().toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) return null;

  const lastTwo = labels.slice(-2).join(".");
  if (TWO_PART_PUBLIC_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
}

function companyNameFromRegistrableDomain(domain) {
  return domain.split(".")[0] || domain;
}

function parseContactEmailDomain(email) {
  const host = extractEmailHost(email);
  if (!host) return null;

  const domain = getRegistrableDomain(host);
  if (!domain) return null;

  return {
    host,
    domain,
    name: companyNameFromRegistrableDomain(domain),
  };
}

async function resolveOrCreateCompanyByDomain(tx, { host, domain, name }) {
  const normalizedDomain = domain.trim().toLowerCase();
  const derivedName = name || companyNameFromRegistrableDomain(normalizedDomain);

  const byDomain = await tx.company.findFirst({
    where: { domain: { equals: normalizedDomain, mode: "insensitive" } },
  });
  if (byDomain) return byDomain;

  if (host !== normalizedDomain) {
    const legacyByHost = await tx.company.findFirst({
      where: { domain: { equals: host, mode: "insensitive" } },
    });
    if (legacyByHost) {
      return tx.company.update({
        where: { id: legacyByHost.id },
        data: { name: derivedName, domain: normalizedDomain },
      });
    }
  }

  const legacyByDomainName = await tx.company.findFirst({
    where: { name: { equals: normalizedDomain, mode: "insensitive" } },
  });
  if (legacyByDomainName) {
    return tx.company.update({
      where: { id: legacyByDomainName.id },
      data: { name: derivedName, domain: normalizedDomain },
    });
  }

  const byNameWithoutDomain = await tx.company.findFirst({
    where: {
      name: { equals: derivedName, mode: "insensitive" },
      domain: null,
    },
  });
  if (byNameWithoutDomain) {
    return tx.company.update({
      where: { id: byNameWithoutDomain.id },
      data: { domain: normalizedDomain },
    });
  }

  return tx.company.create({
    data: { name: derivedName, domain: normalizedDomain },
  });
}

async function resolveOrCreateCompanyByName(tx, companyName) {
  const name = normalizeCompanyName(companyName);
  if (!name) return null;

  const existing = await tx.company.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      domain: null,
    },
  });
  if (existing) return existing;

  return tx.company.create({ data: { name, domain: null } });
}

export async function resolveOrCreateCompany(tx, companyName, { domain = null } = {}) {
  if (domain?.trim()) {
    return resolveOrCreateCompanyByDomain(tx, {
      host: domain.trim().toLowerCase(),
      domain: domain.trim().toLowerCase(),
      name: companyNameFromRegistrableDomain(domain.trim().toLowerCase()),
    });
  }

  return resolveOrCreateCompanyByName(tx, companyName);
}

/** Prefer email domain for company; fall back to contact company field when email is missing. */
export async function resolveOrCreateCompanyFromContact(tx, { email, companyName }) {
  const parsed = parseContactEmailDomain(email);
  if (parsed) {
    return resolveOrCreateCompanyByDomain(tx, parsed);
  }

  return resolveOrCreateCompanyByName(tx, companyName);
}

export async function resolveOrCreateBusinessUser(
  tx,
  {
    company,
    name,
    firstName,
    lastName,
    jobTitle,
    department,
    seniority,
    email,
    phone,
    whatsapp,
    linkedinUrl,
    twitterId,
    location,
  }
) {
  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) {
    throw new Error("Business user name is required");
  }

  const normalizedEmail = normalizeEmail(email);

  let companyId = null;
  const companyRow = await resolveOrCreateCompanyFromContact(tx, {
    email: normalizedEmail,
    companyName: company,
  });
  companyId = companyRow?.id ?? null;
  const normalizedLinkedin = linkedinUrl?.trim() || null;

  let existing = null;
  if (normalizedEmail) {
    existing = await tx.businessUser.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
  }
  if (!existing && normalizedLinkedin) {
    existing = await tx.businessUser.findFirst({
      where: { linkedinUrl: normalizedLinkedin },
    });
  }
  if (!existing && companyId) {
    existing = await tx.businessUser.findFirst({
      where: {
        companyId,
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });
  }

  const data = {
    companyId,
    name: trimmedName,
    firstName: firstName?.trim() || null,
    lastName: lastName?.trim() || null,
    jobTitle: jobTitle?.trim() || null,
    department: department?.trim() || null,
    seniority: seniority?.trim() || null,
    email: normalizedEmail || null,
    phone: phone?.trim() || null,
    whatsapp: whatsapp?.trim() || null,
    linkedinUrl: normalizedLinkedin,
    twitterId: twitterId?.trim() || null,
    location: location?.trim() || null,
  };

  if (existing) {
    const updated = await tx.businessUser.update({
      where: { id: existing.id },
      data: {
        companyId: data.companyId ?? existing.companyId,
        firstName: data.firstName ?? existing.firstName,
        lastName: data.lastName ?? existing.lastName,
        jobTitle: data.jobTitle ?? existing.jobTitle,
        department: data.department ?? existing.department,
        seniority: data.seniority ?? existing.seniority,
        email: data.email ?? existing.email,
        phone: data.phone ?? existing.phone,
        whatsapp: data.whatsapp ?? existing.whatsapp,
        linkedinUrl: data.linkedinUrl ?? existing.linkedinUrl,
        twitterId: data.twitterId ?? existing.twitterId,
        location: data.location ?? existing.location,
      },
    });
    return updated;
  }

  return tx.businessUser.create({ data });
}

export async function resolveOrCreateContact(
  tx,
  tenantId,
  { persona, ...businessUserFields }
) {
  const businessUser = await resolveOrCreateBusinessUser(tx, businessUserFields);

  const existing = await tx.contact.findUnique({
    where: {
      tenantId_businessUserId: {
        tenantId,
        businessUserId: businessUser.id,
      },
    },
  });
  if (existing) {
    if (persona && existing.persona === "OTHER") {
      return tx.contact.update({
        where: { id: existing.id },
        data: { persona: normalizeContactPersona(persona) },
      });
    }
    return existing;
  }

  return tx.contact.create({
    data: {
      tenantId,
      businessUserId: businessUser.id,
      persona: normalizeContactPersona(persona),
    },
  });
}

export async function enrollContactInCampaign(
  tx,
  { contactId, campaignId, outreachDeliveryTime = null, nextScheduledOutreachAt = null }
) {
  const existing = await tx.campaignContact.findUnique({
    where: {
      contactId_campaignId: { contactId, campaignId },
    },
  });
  if (existing) return existing;

  return tx.campaignContact.create({
    data: {
      contactId,
      campaignId,
      outreachDeliveryTime: outreachDeliveryTime?.trim() || null,
      nextScheduledOutreachAt,
    },
  });
}

/** Flatten campaignContact + nested contact/businessUser for templates and UI. */
export function flattenCampaignContact(cc) {
  const bu = cc.contact?.businessUser;
  return {
    id: cc.id,
    contactId: cc.contactId,
    campaignContactId: cc.id,
    status: cc.status,
    persona: cc.contact?.persona ?? "OTHER",
    name: bu?.name ?? "",
    firstName: bu?.firstName ?? null,
    lastName: bu?.lastName ?? null,
    company: bu?.company?.name ?? null,
    jobTitle: bu?.jobTitle ?? null,
    department: bu?.department ?? null,
    email: bu?.email ?? null,
    phone: bu?.phone ?? null,
    whatsapp: bu?.whatsapp ?? null,
    linkedinUrl: bu?.linkedinUrl ?? null,
    twitterId: bu?.twitterId ?? null,
    businessUserId: bu?.id ?? null,
    qualifiedAt: cc.qualifiedAt,
    qualifiedReason: cc.qualifiedReason,
    isQualified: cc.status === "QUALIFIED",
    score: cc.score ?? 0,
    scoreBreakdown: Array.isArray(cc.scoreBreakdown) ? cc.scoreBreakdown : [],
    outreachDeliveryTime: cc.outreachDeliveryTime,
    nextScheduledOutreachAt: cc.nextScheduledOutreachAt,
    lastOutreachDate: cc.lastOutreachDate,
    whatsapp24hWindowExpiresAt: cc.whatsapp24hWindowExpiresAt ?? null,
    signals: bu?.signals ?? [],
    contact: cc.contact,
    businessUser: bu,
  };
}
