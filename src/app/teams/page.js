"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import TeamSection from "@/components/settings/TeamSection";
import { useUser } from "@/context/UserContext";
import { ui } from "@/lib/brandUi";

const TeamsPage = () => {
  const user = useUser();

  return (
    <div className={`${ui.page} p-5 lg:p-7 w-full space-y-8`}>
      <header>
        <h1 className={ui.title}>Team</h1>
        <p className={ui.subtitle}>
          Invite members and manage workspace permissions.
        </p>
      </header>

      <section className="w-full">
        {user?.canManageTeam ? (
          <div className={ui.panelSurface}>
            <TeamSection />
          </div>
        ) : (
          <div className={ui.panelSurface}>
            <p className="text-sm text-brand-stone">
              Team management is available only to tenant admins.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardLayout()(TeamsPage);
