/** Normalize a LinkedIn profile URL for API calls and matching. */
export function normalizeLinkedInProfileUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  if (trimmed.includes("linkedin.com")) {
    return `https://${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  }
  return `https://www.linkedin.com/in/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

/** Extract a comparable slug from a LinkedIn profile URL (e.g. jane-doe-42). */
export function linkedInProfileSlug(url) {
  const normalized = normalizeLinkedInProfileUrl(url);
  if (!normalized) return null;
  try {
    const pathname = new URL(normalized).pathname;
    const match = pathname.match(/\/in\/([^/?#]+)/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    const match = String(url).match(/linkedin\.com\/in\/([^/?#]+)/i);
    return match?.[1]?.toLowerCase() ?? null;
  }
}

/** True if two LinkedIn URLs refer to the same profile. */
export function linkedInUrlsMatch(a, b) {
  if (!a || !b) return false;
  const slugA = linkedInProfileSlug(a);
  const slugB = linkedInProfileSlug(b);
  if (slugA && slugB) return slugA === slugB;
  const memberA = linkedInMemberIdFromUrl(a);
  const memberB = linkedInMemberIdFromUrl(b);
  if (memberA && memberB) return memberA === memberB;
  const normA = normalizeLinkedInProfileUrl(a);
  const normB = normalizeLinkedInProfileUrl(b);
  return normA === normB;
}

/** LinkedIn internal member id from URN-style /in/ACo… profile URLs (webhooks). */
export function linkedInMemberIdFromUrl(url) {
  const slug = linkedInProfileSlug(url);
  if (!slug || !/^aco[a-z0-9_-]+$/i.test(slug)) return null;
  return slug.toUpperCase();
}

/** Extract member id from a Linkup profile_urn value. */
export function linkedInMemberIdFromUrn(urn) {
  if (!urn) return null;
  const match = String(urn).match(/:([A-Za-z0-9_-]+)$/);
  return match?.[1]?.toUpperCase() ?? null;
}

/** Extract member id from message entity_urn (contains fsd_profile:ACo…). */
export function linkedInMemberIdFromEntityUrn(entityUrn) {
  if (!entityUrn) return null;
  const match = String(entityUrn).match(/fsd_profile:([A-Za-z0-9_-]+)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function normalizePersonName(name) {
  return (
    name
      ?.trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ") ?? ""
  );
}

export function personNameMatches(businessUser, senderName) {
  if (!businessUser || !senderName?.trim()) return false;
  const sender = normalizePersonName(senderName);
  if (!sender) return false;

  const candidates = [
    businessUser.name,
    [businessUser.firstName, businessUser.lastName].filter(Boolean).join(" "),
  ]
    .map(normalizePersonName)
    .filter(Boolean);

  return candidates.some((candidate) => candidate === sender);
}
