/** Public app base URL for redirects, tracked links, and webhooks. */
export function getAppBaseUrl() {
  const url =
    process.env.NEXT_PUBLIC_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}
