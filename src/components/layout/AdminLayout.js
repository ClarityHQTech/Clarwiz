"use client";

import AdminMobileMenu from "./AdminMobileMenu";
import AdminSidebar from "./AdminSidebar";

const AdminLayout = () => (WrappedComponent) => {
    const adminLayout = (props) => {


  
      return (
        <>
          {/* <Title /> */}
          <div className="h-screen flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-1/6 bg-cyan-800 sticky top-0 h-screen overflow-y-auto border hidden lg:block no-scrollbar">
              <AdminSidebar/>
            </div>

            <div className="lg:hidden">
              <AdminMobileMenu/>
            </div>
  
            {/* Main Content */}
            <div className="w-full lg:w-5/6 overflow-y-auto h-screen">
              <WrappedComponent {...props} />
            </div>
          </div>
        </>
      );
    };

    return adminLayout;
  };

export default AdminLayout