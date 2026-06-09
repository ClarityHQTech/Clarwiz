import { prisma } from "@/lib/prisma";
import { linkupGetProfile } from "@/lib/linkupApi";
import {
  linkedInMemberIdFromEntityUrn,
  linkedInMemberIdFromUrl,
  linkedInMemberIdFromUrn,
  linkedInProfileSlug,
  linkedInUrlsMatch,
  personNameMatches,
} from "@/lib/linkedinProfileUrl";

const contactCampaignInclude = {
  contact: { include: { businessUser: true } },
};

function collectMemberIds({ profileUrl, entityUrn }) {
  const ids = new Set();
  const fromUrl = linkedInMemberIdFromUrl(profileUrl);
  const fromEntity = linkedInMemberIdFromEntityUrn(entityUrn);
  if (fromUrl) ids.add(fromUrl);
  if (fromEntity) ids.add(fromEntity);
  return ids;
}

function matchRowsByLinkedInUrl(rows, profileUrl) {
  if (!profileUrl) return [];
  return rows.filter((row) => {
    const url = row.contact?.businessUser?.linkedinUrl;
    return url && linkedInUrlsMatch(url, profileUrl);
  });
}

function matchRowsByName(rows, senderName) {
  if (!senderName?.trim()) return [];
  const matches = rows.filter((row) =>
    personNameMatches(row.contact?.businessUser, senderName)
  );
  if (matches.length === 1) return matches;
  const withLinkedin = matches.filter((row) =>
    row.contact?.businessUser?.linkedinUrl?.trim()
  );
  if (withLinkedin.length === 1) return withLinkedin;
  return matches.length === 1 ? matches : [];
}

function memberIdFromDeliveryMeta(meta) {
  const ids = [];
  const fromUrn = linkedInMemberIdFromUrn(meta?.profileUrn);
  const fromEntity = linkedInMemberIdFromEntityUrn(meta?.entityUrn);
  if (fromUrn) ids.push(fromUrn);
  if (fromEntity) ids.push(fromEntity);
  if (meta?.publicIdentifier) {
    ids.push(String(meta.publicIdentifier).toUpperCase());
  }
  const senderMember = linkedInMemberIdFromUrl(meta?.senderProfileUrl);
  if (senderMember) ids.push(senderMember);
  return ids;
}

async function matchRowsByCommLogs(tenantId, rows, memberIds) {
  if (!memberIds.size || rows.length === 0) return [];

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const logs = await prisma.communicationLog.findMany({
    where: {
      tenantId,
      channel: "linkedin",
      contactCampaignId: { in: [...rowById.keys()] },
    },
    select: { contactCampaignId: true, deliveryMeta: true },
    orderBy: { sentAt: "desc" },
    take: 500,
  });

  const matchedIds = new Set();
  for (const log of logs) {
    const metaIds = memberIdFromDeliveryMeta(log.deliveryMeta ?? {});
    if (metaIds.some((id) => memberIds.has(id))) {
      matchedIds.add(log.contactCampaignId);
    }
  }

  return [...matchedIds].map((id) => rowById.get(id)).filter(Boolean);
}

function matchRowsByPublicId(rows, publicId, canonicalProfileUrl) {
  const slug = publicId?.trim().toLowerCase();
  if (!slug && !canonicalProfileUrl) return [];

  return rows.filter((row) => {
    const url = row.contact?.businessUser?.linkedinUrl;
    if (!url) return false;
    if (canonicalProfileUrl && linkedInUrlsMatch(url, canonicalProfileUrl)) {
      return true;
    }
    return slug && linkedInProfileSlug(url) === slug;
  });
}

async function resolveViaLinkupProfile(rows, { accountId, profileUrl }) {
  if (!accountId || !profileUrl || !linkedInMemberIdFromUrl(profileUrl)) {
    return [];
  }

  try {
    const result = await linkupGetProfile({ accountId, profileUrl });
    const data = result.data ?? {};
    return matchRowsByPublicId(
      rows,
      data.public_id,
      data.profile_url
    );
  } catch (err) {
    console.warn("[linkup webhook] profile resolve failed:", err.message);
    return [];
  }
}

/**
 * Find contact-campaign rows for an inbound LinkedIn sender (webhook).
 * Linkup often sends URN-style profile URLs; contacts usually store vanity URLs.
 */
export async function findContactCampaignsForLinkedInSender(
  tenantId,
  { profileUrl, senderName, entityUrn, linkupAccountId }
) {
  const rows = await prisma.contactCampaign.findMany({
    where: { contact: { tenantId } },
    include: contactCampaignInclude,
  });

  if (!rows.length) return [];

  let matches = matchRowsByLinkedInUrl(rows, profileUrl);
  if (matches.length) return matches;

  const memberIds = collectMemberIds({ profileUrl, entityUrn });
  if (memberIds.size) {
    matches = await matchRowsByCommLogs(tenantId, rows, memberIds);
    if (matches.length) return matches;
  }

  matches = matchRowsByName(rows, senderName);
  if (matches.length) return matches;

  matches = await resolveViaLinkupProfile(rows, {
    accountId: linkupAccountId,
    profileUrl,
  });
  return matches;
}
