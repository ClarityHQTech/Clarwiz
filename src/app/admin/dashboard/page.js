"use client";

import AdminLayout from "@/components/layout/AdminLayout";

const Page = () => {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-700">
          Campaign metrics and platform analytics will be added here.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Use the Users tab for tenant-level details and Manage tab for workspace operations.
        </p>
      </div>
    </div>
  );
};

export default AdminLayout()(Page);
