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

  if (!user?.payment) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full rounded-lg border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            You don't have access to this.
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Payment is required to access the admin area.
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
      <div className="w-1/6 bg-cyan-800 sticky top-0 h-screen overflow-y-auto border hidden lg:block no-scrollbar">
        <AdminSidebar />
      </div>

      <div className="lg:hidden">
        <AdminMobileMenu />
      </div>

      <div className="w-full lg:w-5/6 overflow-y-auto h-screen">
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
