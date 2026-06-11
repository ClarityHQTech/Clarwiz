/** Remove in-app collateral viewer links from NBA email HTML (not valid for recipients). */
export function stripCollateralViewerLinks(html) {
  if (typeof html !== "string" || !html.trim()) return html;
  let out = html;
  out = out.replace(
    /<p[^>]*>\s*<a[^>]*href=["']\/assist\/collaterals\?open=[^"']*["'][^>]*>[\s\S]*?<\/a>\s*<\/p>/gi,
    ""
  );
  out = out.replace(/<a[^>]*href=["']\/assist\/collaterals\?open=[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, "");
  return out.trim();
}
