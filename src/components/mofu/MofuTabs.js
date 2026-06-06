"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/mofu", "Deals"],
  ["/mofu/companies", "Companies"],
  ["/mofu/contacts", "Contacts"],
  ["/mofu/collateral", "Collateral"],
];

export default function MofuTabs() {
  const pathname = usePathname();
  return (
    <div className="mofu-tabsbar" style={{ flexWrap: "wrap" }}>
      {TABS.map(([href, label]) => {
        const active = href === "/mofu" ? pathname === "/mofu" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="mofu-navtab"
            style={
              active
                ? { background: "var(--accent-soft)", color: "var(--accent-ink)", fontWeight: 700 }
                : undefined
            }
          >
            {label}
          </Link>
        );
      })}
      <span style={{ flex: 1 }} />
      <span className="sor-pill">HubSpot · SOR connected</span>
    </div>
  );
}
