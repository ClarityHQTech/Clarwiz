"use client";

import AdminLayout from "@/components/layout/AdminLayout";

const Page = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Clients</h1>
    </div>
  );
};

export default AdminLayout()(Page);
