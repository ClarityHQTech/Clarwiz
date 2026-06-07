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

export async function resolveOrCreateCompany(tx, companyName) {
  const name = normalizeCompanyName(companyName);
  if (!name) return null;

  const existing = await tx.company.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;

  return tx.company.create({ data: { name } });
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

  let companyId = null;
  if (company?.trim()) {
    const companyRow = await resolveOrCreateCompany(tx, company);
    companyId = companyRow?.id ?? null;
  }

  const normalizedEmail = normalizeEmail(email);
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
  const existing = await tx.contactCampaign.findUnique({
    where: {
      contactId_campaignId: { contactId, campaignId },
    },
  });
  if (existing) return existing;

  return tx.contactCampaign.create({
    data: {
      contactId,
      campaignId,
      outreachDeliveryTime: outreachDeliveryTime?.trim() || null,
      nextScheduledOutreachAt,
    },
  });
}

/** Flatten contactCampaign + nested contact/businessUser for templates and UI. */
export function flattenContactCampaign(cc) {
  const bu = cc.contact?.businessUser;
  return {
    id: cc.id,
    contactId: cc.contactId,
    contactCampaignId: cc.id,
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
    outreachDeliveryTime: cc.outreachDeliveryTime,
    nextScheduledOutreachAt: cc.nextScheduledOutreachAt,
    lastOutreachDate: cc.lastOutreachDate,
    whatsapp24hWindowExpiresAt: cc.whatsapp24hWindowExpiresAt ?? null,
    signals: bu?.signals ?? [],
    contact: cc.contact,
    businessUser: bu,
  };
}
