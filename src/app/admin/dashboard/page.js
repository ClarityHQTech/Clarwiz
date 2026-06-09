"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { ui } from "@/lib/brandUi";

const Page = () => {
  return (
    <div className={`${ui.page} p-8 space-y-4`}>
      <h1 className={ui.title}>Admin Dashboard</h1>
      <div className={`${ui.cardSurface} p-5`}>
        <p className="text-sm text-brand-stone">
          Campaign metrics and platform analytics will be added here.
        </p>
        <p className="mt-2 text-xs text-brand-stone">
          Use the Users tab for tenant-level details and Manage tab for workspace operations.
        </p>
      </div>
    </div>
  );
};

export default AdminLayout()(Page);
