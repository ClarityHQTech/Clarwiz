"use client";

import { useEffect, useState } from "react";
import MobileDashMenu from "./MobileDashMenu";
import Sidebar from "./Sidebar";
import { useUser } from "@/context/UserContext";
import Loader from "@/components/shared/Loader";
import Link from "next/link";
import { usePathname } from "next/navigation";
import TenantWorkspaces from "@/components/profile/TenantWorkspaces";

const PAYMENT_ALLOWED_PATHS = ["/pricing", "/profile"];
const TENANT_SETUP_PATHS = ["/profile"];
const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

function DashboardShell({ children }) {
  const user = useUser();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  if (user === undefined) {
    return <Loader fullScreen />;
  }

  const canAccessTenantSetup = TENANT_SETUP_PATHS.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`)
  );

  if (user?.needsTenantSelection && !canAccessTenantSetup) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg p-6">
        <div className="max-w-lg w-full space-y-4">
          <div className="rounded-xl border border-brand-secondary/30 bg-white p-6 text-center">
            <h1 className="font-serif text-lg font-semibold text-brand-ink">
              Select a workspace
            </h1>
            <p className="mt-2 text-sm text-brand-stone">
              {user?.memberships?.length
                ? "Choose a workspace below to continue."
                : "Create your first workspace to get started."}
            </p>
            {!user?.memberships?.length ? (
              <Link
                href={user?.isSuperadmin ? "/admin/manage" : "/profile"}
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink"
              >
                {user?.isSuperadmin ? "Manage tenants" : "Go to profile"}
              </Link>
            ) : (
              <Link
                href="/profile"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink"
              >
                Go to profile
              </Link>
            )}
          </div>
          {user?.memberships?.length ? <TenantWorkspaces /> : null}
        </div>
      </div>
    );
  }

  const canAccessCurrentPage =
    user?.isSuperadmin ||
    user?.payment_status ||
    PAYMENT_ALLOWED_PATHS.some(
      (p) => pathname === p || pathname?.startsWith(`${p}/`)
    );

  return (
    <div className="h-screen flex overflow-hidden">
      <div
        className={`bg-brand-dark sticky top-0 h-screen overflow-hidden border hidden lg:block transition-all duration-300 ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
      </div>

      <div className="flex-1 overflow-y-auto h-screen bg-brand-bg relative">
        <MobileDashMenu />
        {canAccessCurrentPage ? (
          children
        ) : (
          <div className="h-full flex items-center justify-center bg-brand-bg p-6">
            <div className="max-w-md w-full rounded-xl border border-brand-secondary/30 bg-white p-6 text-center">
              <h1 className="font-serif text-lg font-semibold text-brand-ink">
                You don&apos;t have access to this.
              </h1>
              <p className="mt-2 text-sm text-brand-stone">
                This workspace does not have an active subscription.
              </p>
              <Link
                href="/pricing"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink"
              >
                Go to pricing
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const DashboardLayout = () => (WrappedComponent) => {
  const WithDashboardLayout = (props) => (
    <DashboardShell>
      <WrappedComponent {...props} />
    </DashboardShell>
  );

  return WithDashboardLayout;
};

export default DashboardLayout;
