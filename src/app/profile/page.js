"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import TenantWorkspaces from "@/components/profile/TenantWorkspaces";
import TenantDetailsSection from "@/components/profile/TenantDetailsSection";
import { ui } from "@/lib/brandUi";
import { useUser } from "@/context/UserContext";
import Link from "next/link";

const ProfilePage = () => {
  const user = useUser();

  return (
    <div className={`${ui.page} ${ui.container} w-full space-y-6`}>
      <TenantWorkspaces />

      <section className={ui.section}>
        <div className="flex items-start gap-4">
          <img
            src={
              user?.image ||
              "https://t4.ftcdn.net/jpg/07/03/86/11/360_F_703861114_7YxIPnoH8NfmbyEffOziaXy0EO1NpRHD.jpg"
            }
            alt={user?.name || "Profile"}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-brand-secondary/30"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={ui.titleSm}>{user?.name || "Profile"}</h1>
              {user?.isSuperadmin ? (
                <span className={ui.badgeAdmin}>Superadmin</span>
              ) : null}
            </div>
            <p className="text-sm text-brand-stone">{user?.email}</p>
            {user?.isSuperadmin && user?.tenantName ? (
              <p className="text-sm text-brand-stone mt-1">
                Active workspace · {user.tenantName}
              </p>
            ) : null}
            <p className="text-sm text-brand-stone mt-1">
              Subscription ·{" "}
              {user?.payment_status ? (
                <span className="text-brand-ink font-medium">Active</span>
              ) : (
                <span className="text-red-600 font-medium">Inactive</span>
              )}
            </p>
            {user?.isSuperadmin ? (
              <Link
                href="/admin/dashboard"
                className={`mt-3 inline-block ${ui.btnPrimary}`}
              >
                Admin Panel
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <TenantDetailsSection />
    </div>
  );
};

export default DashboardLayout()(ProfilePage);
