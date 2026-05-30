"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";
import Link from "next/link";

const PricingPage = () => {
  return (
    <div className={`${ui.page} p-5 lg:p-7 max-w-4xl`}>
      <h1 className={ui.title}>Pricing</h1>
      <p className={ui.subtitle}>
        Unlock campaign execution, outreach, and tracking by activating your
        workspace subscription.
      </p>

      <div className={`mt-6 ${ui.card} p-6`}>
        <h2 className={`${ui.titleSm} text-lg`}>Pro Workspace</h2>
        <p className="mt-2 text-sm text-brand-stone">
          Access all dashboard tabs, run campaigns, and use integrations after
          payment is enabled for your account.
        </p>
        <div className="mt-4">
          <Link
            href="mailto:sales@clarwiz.com?subject=Activate%20Clarwiz%20by%20ClarityHQ%20subscription"
            className={ui.btnPrimary}
          >
            Contact sales to activate
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout()(PricingPage);
