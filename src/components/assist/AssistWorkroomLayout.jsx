"use client";

import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import CockpitChat from "@/components/assist/cockpit/CockpitChat";
import { ui } from "@/lib/brandUi";

export default function AssistWorkroomLayout({
  crumbs = [],
  title,
  subtitle,
  eyebrow,
  actions,
  cockpitContext,
  children,
}) {
  const trail = crumbs.length ? crumbs : [];

  return (
    <div className={`${ui.page} ${ui.container} space-y-6`}>
      <Link href="/assist" className={`inline-flex items-center gap-1 ${ui.link}`}>
        <HiOutlineArrowLeft className="h-4 w-4" />
        AE Assist
        {trail.length > 0 ? (
          <span className="text-brand-stone font-normal">
            {" / "}
            {trail.join(" / ")}
          </span>
        ) : null}
      </Link>

      {(title || actions) && (
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <p className={`${ui.label} mb-1 normal-case tracking-wide`}>{eyebrow}</p> : null}
            {title ? <h1 className={ui.title}>{title}</h1> : null}
            {subtitle ? <p className={ui.subtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
      )}

      {children}

      {cockpitContext ? <CockpitChat pageContext={cockpitContext} /> : null}
    </div>
  );
}
