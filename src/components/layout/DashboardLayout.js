"use client";

import { useState } from "react";
import MobileDashMenu from "./MobileDashMenu";
import Sidebar from "./Sidebar";
import { useUser } from "@/context/UserContext";
import Loader from "@/components/shared/Loader";
import Link from "next/link";

function DashboardShell({ children }) {
  const user = useUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (user === undefined) {
    return <Loader fullScreen />;
  }

  if (!user?.payment) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full rounded-lg border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            You don't have access to this.
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Payment is required to access the dashboard and campaigns.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

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

      <div className="flex-1 overflow-y-auto h-screen">{children}</div>
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
