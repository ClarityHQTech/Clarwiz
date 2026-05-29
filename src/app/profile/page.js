"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import TenantWorkspaces from "@/components/profile/TenantWorkspaces";
import TeamSection from "@/components/settings/TeamSection";
import { useUser } from "@/context/UserContext";

const ProfilePage = () => {
  const user = useUser();

  return (
    <div className="p-5 lg:p-7 w-full space-y-6">
      <TenantWorkspaces />

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <img
            src={
              user?.image ||
              "https://t4.ftcdn.net/jpg/07/03/86/11/360_F_703861114_7YxIPnoH8NfmbyEffOziaXy0EO1NpRHD.jpg"
            }
            alt={user?.name || "Profile"}
            className="h-14 w-14 rounded-full object-cover"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900">
              {user?.name || "Profile"}
            </h1> 
            <p className="text-sm text-gray-600">{user?.email}</p>
            <p className="text-sm text-gray-500 mt-1">
              Subscription ·{" "}
              {user?.payment_status ? (
                <span className="text-green-600 font-medium">Active</span>
              ) : (
                <span className="text-red-600 font-medium">Inactive</span>
              )}
            </p>
          </div>
        </div>
      </section>

      {user?.canManageTeam ? (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <TeamSection />
        </section>
      ) : (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">
            Team management is available only to tenant admins.
          </p>
        </section>
      )}
    </div>
  );
};

export default DashboardLayout()(ProfilePage);
