"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Link from "next/link";

const PricingPage = () => {
  return (
    <div className="p-5 lg:p-7 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900">Pricing</h1>
      <p className="mt-2 text-sm text-gray-600">
        Unlock campaign execution, outreach, and tracking by activating your
        workspace subscription.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-medium text-gray-900">Pro Workspace</h2>
        <p className="mt-2 text-sm text-gray-600">
          Access all dashboard tabs, run campaigns, and use integrations after
          payment is enabled for your account.
        </p>
        <div className="mt-4">
          <Link
            href="mailto:sales@clarwiz.com?subject=Activate%20ClarWiz%20subscription"
            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Contact sales to activate
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout()(PricingPage);
