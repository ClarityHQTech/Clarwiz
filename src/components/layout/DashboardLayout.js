"use client";

import MobileDashMenu from "./MobileDashMenu";
import Sidebar from "./Sidebar";
import { useUser } from "@/context/UserContext";
import Loader from "@/components/shared/Loader";

function DashboardShell({ children }) {
  const user = useUser();

  if (user === undefined) {
    return <Loader fullScreen />;
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="w-1/6 bg-sky-800 sticky top-0 h-screen overflow-y-auto border hidden lg:block no-scrollbar">
        <Sidebar />
      </div>

      <div className="lg:hidden">
        <MobileDashMenu />
      </div>

      <div className="w-full lg:w-5/6 overflow-y-auto h-screen">
        {children}
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
