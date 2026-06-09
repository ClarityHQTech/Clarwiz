"use client";

import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";

function AssistNotice({ title, message, ctaLabel, ctaHref }) {
  return (
    <div className={`${ui.page} ${ui.container}`}>
      <div className={`${ui.cardSurface} max-w-lg mx-auto mt-16 p-10 text-center`}>
        <h1 className={`${ui.titleSm} mb-3`}>{title}</h1>
        <p className={`${ui.body} mb-6`}>{message}</p>
        {ctaLabel && ctaHref ? (
          <Link href={ctaHref} className={ui.btnPrimary}>
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default DashboardLayout()(AssistNotice);
