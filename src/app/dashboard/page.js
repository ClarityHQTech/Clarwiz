"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";

const Page = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
    </div>
  );
};

export default DashboardLayout()(Page);
