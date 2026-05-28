"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";

const Page = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users");
  }, [router]);

  return (
    <div className="p-8">
      <p className="text-sm text-gray-600">Redirecting to Users...</p>
    </div>
  );
};

export default AdminLayout()(Page);
