"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import IcpContextSection from "@/components/settings/IcpContextSection";
import { useUser } from "@/context/UserContext";
import { ui } from "@/lib/brandUi";

const ContextPage = () => {
  const user = useUser();

  return (
    <div className={`${ui.page} p-5 lg:p-7 w-full space-y-8`}>
      <header>
        <h1 className={ui.title}>Context</h1>
        <p className={ui.subtitle}>
          Run ICP analysis and manage tenant context for smarter outreach.
        </p>
      </header>

      <section className="w-full">
        <div className={ui.panelSurface}>
          {user?.canAccessIcpCall !== false ? (
            <IcpContextSection />
          ) : (
            <p className="text-sm text-brand-stone">
              You do not have permission to manage ICP context.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardLayout()(ContextPage);
