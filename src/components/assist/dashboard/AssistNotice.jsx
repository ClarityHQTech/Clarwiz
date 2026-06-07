"use client";

import NextLink from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssistShell from "@/components/assist/AssistShell";

/**
 * Full-page cockpit notice — used for the "Connect HubSpot" empty state and the
 * "no active workspace" state.
 */
function AssistNotice({ title, message, ctaLabel, ctaHref }) {
  return (
    <AssistShell active="dashboard" crumbs={["Today"]}>
      <div className="ck-card" style={{ padding: 48, textAlign: "center", maxWidth: 640, margin: "40px auto" }}>
        <div className="ck-page-title" style={{ fontSize: 30, marginBottom: 12 }}>
          {title}
        </div>
        <p className="ck-page-subtitle" style={{ margin: "0 auto 24px" }}>
          {message}
        </p>
        {ctaLabel && ctaHref && (
          <NextLink href={ctaHref} className="ck-btn ck-btn-primary">
            {ctaLabel}
          </NextLink>
        )}
      </div>
    </AssistShell>
  );
}

export default DashboardLayout()(AssistNotice);
