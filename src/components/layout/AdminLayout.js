"use client";

import AdminMobileMenu from "./AdminMobileMenu";
import AdminSidebar from "./AdminSidebar";
import { useUser } from "@/context/UserContext";
import Loader from "@/components/shared/Loader";

function AdminShell({ children }) {
  const user = useUser();

  if (user === undefined) {
    return <Loader fullScreen />;
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
