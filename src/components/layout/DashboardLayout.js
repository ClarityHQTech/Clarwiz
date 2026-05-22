"use client";

import MobileDashMenu from "./MobileDashMenu";
import Sidebar from "./Sidebar";

const DashboardLayout = () => (WrappedComponent) => {
    const dashLayout = (props) => {


  
      return (
        <>
          {/* <Title /> */}
          <div className="h-screen flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-1/6 bg-sky-800 sticky top-0 h-screen overflow-y-auto border hidden lg:block no-scrollbar">
              <Sidebar/>
            </div>

            <div className="lg:hidden">
              <MobileDashMenu/>
            </div>
  
            {/* Main Content */}
            <div className="w-full lg:w-5/6 overflow-y-auto h-screen">
              <WrappedComponent {...props} />
            </div>
          </div>
        </>
      );
    };

    return dashLayout;
  };

export default DashboardLayout