"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ui } from "@/lib/brandUi";
import { HiOutlineSparkles } from "react-icons/hi2";

const PricingPage = () => {
  return (
    <div className={`${ui.page} p-5 lg:p-7 w-full space-y-8`}>
      <header>
        <h1 className={ui.title}>Pricing</h1>
        <p className={ui.subtitle}>
          Plans and billing for your Clarwiz workspace.
        </p>
      </header>

      <section className="w-full">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="w-full max-w-lg rounded-xl border border-dashed border-brand-secondary/30 bg-brand-surface px-8 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-sage/20 text-brand-ink">
              <HiOutlineSparkles className="h-6 w-6" aria-hidden />
            </div>
            <h2 className={`${ui.titleSm} mt-4 text-lg`}>Coming soon</h2>
            <p className="mt-2 text-sm text-brand-stone leading-relaxed">
              We&apos;re putting the finishing touches on flexible plans for teams
              of every size. Check back here for updates.
            </p>
            <p className="mt-6 text-xs text-brand-steel">
              Need access now? Contact your workspace admin or reach out to{" "}
              <a
                href="mailto:sales@clarwiz.com?subject=Clarwiz%20pricing%20inquiry"
                className="font-medium text-brand-terracotta hover:text-brand-ink transition-colors"
              >
                sales@clarwiz.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout()(PricingPage);
