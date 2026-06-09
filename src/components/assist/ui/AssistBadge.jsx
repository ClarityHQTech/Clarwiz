"use client";

const VARIANTS = {
  ok: "bg-brand-sage/25 text-brand-ink ring-brand-sage/40",
  warn: "bg-brand-gold/20 text-brand-ink ring-brand-gold/35",
  danger: "bg-red-100 text-red-800 ring-red-200/60",
  info: "bg-brand-terracotta/20 text-brand-ink ring-brand-terracotta/30",
  accent: "bg-brand-terracotta/25 text-brand-ink ring-brand-terracotta/40",
  ghost: "bg-brand-bg text-brand-stone ring-brand-steel/30",
};

export default function AssistBadge({ variant = "ghost", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${VARIANTS[variant] ?? VARIANTS.ghost} ${className}`}
    >
      {children}
    </span>
  );
}
