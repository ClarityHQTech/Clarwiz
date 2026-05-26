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
  const normA = normalizeLinkedInProfileUrl(a);
  const normB = normalizeLinkedInProfileUrl(b);
  return normA === normB;
}
