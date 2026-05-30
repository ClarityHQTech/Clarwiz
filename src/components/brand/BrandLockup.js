import { BRAND } from "@/lib/brandUi";

/** Product + parent brand mark for nav and headers. */
export default function BrandLockup({
  className = "",
  productClassName = "font-serif font-semibold text-lg text-brand-bg",
  parentClassName = "block text-[10px] text-brand-secondary font-sans tracking-wide",
  inline = false,
}) {
  if (inline) {
    return (
      <span className={className}>
        <span className="font-serif font-semibold text-brand-ink">
          {BRAND.productName}
        </span>
        <span className="text-sm font-sans text-brand-stone">
          {" "}
          by {BRAND.parentBrand}
        </span>
      </span>
    );
  }

  return (
    <span className={className}>
      <span className={productClassName}>{BRAND.productName}</span>
      <span className={parentClassName}>by {BRAND.parentBrand}</span>
    </span>
  );
}
