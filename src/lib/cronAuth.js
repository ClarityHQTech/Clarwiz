/** Shared secret for outreach cron and internal execute bypass (app SECRET). */
export function getCronSecret() {
  return (
    process.env.SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

export function isCronRequestAuthorized(request) {
  const secret = getCronSecret();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

/** Public app URL for webhook registration and dev cron (NEXT_PUBLIC_URL). */
export function getAppBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000";
  return base.startsWith("http") ? base.replace(/\/$/, "") : `https://${base}`;
}
