"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/mofu", "Deals"],
  ["/mofu/companies", "Companies"],
  ["/mofu/contacts", "Contacts"],
  ["/mofu/marketing", "Marketing"],
];

export default function MofuTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 border-b border-brand-secondary/25 pb-2">
      {TABS.map(([href, label]) => {
        const active = href === "/mofu" ? pathname === "/mofu" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 text-sm rounded-md ${active ? "bg-brand-sage/30 text-brand-ink" : "text-brand-stone hover:bg-brand-sage/15"}`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
