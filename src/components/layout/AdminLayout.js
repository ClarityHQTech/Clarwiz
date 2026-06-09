"use client";

import AdminMobileMenu from "./AdminMobileMenu";
import AdminSidebar from "./AdminSidebar";
import { useUser } from "@/context/UserContext";
import Loader from "@/components/shared/Loader";
import Link from "next/link";

function AdminShell({ children }) {
  const user = useUser();

  if (user === undefined) {
    return <Loader fullScreen />;
  }

  if (!user?.isSuperadmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg p-6">
        <div className="max-w-md w-full rounded-lg border border-brand-secondary/30 bg-brand-surface p-6 text-center">
          <h1 className="text-lg font-semibold text-brand-ink">
            Super admin access required
          </h1>
          <p className="mt-2 text-sm text-brand-stone">
            You do not have permission to access the platform admin area.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="w-1/6 bg-brand-dark sticky top-0 h-screen overflow-y-auto border hidden lg:block no-scrollbar">
        <AdminSidebar />
      </div>

      <div className="w-full lg:w-5/6 overflow-y-auto h-screen bg-brand-bg relative">
        <AdminMobileMenu />
        {children}
      </div>
    </div>
  );
}

const AdminLayout = () => (WrappedComponent) => {
  const WithAdminLayout = (props) => (
    <AdminShell>
      <WrappedComponent {...props} />
    </AdminShell>
  );

  return WithAdminLayout;
};

export default AdminLayout;
