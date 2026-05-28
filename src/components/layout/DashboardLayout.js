"use client";

import { useState } from "react";
import MobileDashMenu from "./MobileDashMenu";
import Sidebar from "./Sidebar";
import { useUser } from "@/context/UserContext";
import Loader from "@/components/shared/Loader";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PAYMENT_ALLOWED_PATHS = ["/pricing", "/profile"];

function DashboardShell({ children }) {
  const user = useUser();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (user === undefined) {
    return <Loader fullScreen />;
  }

  if (user?.needsTenantSelection) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full rounded-lg border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Select a workspace
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {user?.memberships?.length
              ? "Use the workspace switcher in the sidebar after signing in."
              : "Create your first workspace to get started."}
          </p>
          {!user?.memberships?.length ? (
            <Link
              href="/manage-tenant"
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
            >
              Create workspace
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const canAccessCurrentPage =
    user?.payment_status ||
    PAYMENT_ALLOWED_PATHS.some(
      (p) => pathname === p || pathname?.startsWith(`${p}/`)
    );

  return (
    <div className="h-screen flex overflow-hidden">
      <div
        className={`bg-sky-800 sticky top-0 h-screen overflow-y-auto border hidden lg:block no-scrollbar transition-all duration-300 ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-64"
        }`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      </div>

      <div className="lg:hidden">
        <MobileDashMenu />
      </div>

      <div className="flex-1 overflow-y-auto h-screen">
        {canAccessCurrentPage ? (
          children
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50 p-6">
            <div className="max-w-md w-full rounded-lg border border-gray-200 bg-white p-6 text-center">
              <h1 className="text-lg font-semibold text-gray-900">
                You don&apos;t have access to this.
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                This workspace does not have an active subscription.
              </p>
              <Link
                href="/pricing"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
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
