/**
 * Tenant-scoped collateral image library stored on company_details.assist.collateralAssets.
 */

export function getCollateralAssets(companyDetails) {
  const raw = companyDetails?.assist?.collateralAssets;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && typeof a === "object" && typeof a.url === "string" && a.url.trim())
    .map((a) => ({
      id: String(a.id || a.url),
      title: typeof a.title === "string" ? a.title.trim() : "Asset",
      url: a.url.trim(),
      role: typeof a.role === "string" ? a.role.trim() : "general",
    }));
}

export function setCollateralAssets(companyDetails, assets) {
  const base = companyDetails && typeof companyDetails === "object" ? { ...companyDetails } : {};
  const assist = base.assist && typeof base.assist === "object" ? { ...base.assist } : {};
  assist.collateralAssets = assets;
  base.assist = assist;
  return base;
}

export function upsertCollateralAsset(companyDetails, asset) {
  const list = getCollateralAssets(companyDetails);
  const id = asset.id || `asset_${Date.now()}`;
  const next = {
    id,
    title: asset.title?.trim() || "Asset",
    url: asset.url?.trim(),
    role: asset.role?.trim() || "general",
  };
  const idx = list.findIndex((a) => a.id === id);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return setCollateralAssets(companyDetails, list);
}

export function removeCollateralAsset(companyDetails, assetId) {
  const list = getCollateralAssets(companyDetails).filter((a) => a.id !== assetId);
  return setCollateralAssets(companyDetails, list);
}
