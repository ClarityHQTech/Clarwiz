"use client";

import { FaBuilding } from "react-icons/fa6";
import { useUser } from "@/context/UserContext";

const roleLabel = (role) => {
  if (role === "ADMIN") return "Admin";
  if (role === "MEMBER") return "Member";
  return null;
};

export default function ActiveTenantIndicator({ collapsed = false }) {
  const user = useUser();

  if (!user) {
    return null;
  }

  const activeMembership = user.memberships?.find(
    (m) => m.tenantId === user.tenantId
  );
  const tenantName =
    user.tenantName || activeMembership?.tenantName || "No workspace";
  const role = user.isSuperadmin
    ? "Superadmin"
    : roleLabel(activeMembership?.role || user.tenantRole);

  if (!user.tenantId && !user.isSuperadmin) {
    if (!user.memberships?.length) return null;
  }

  if (!user.tenantId) {
    return null;
  }

  if (collapsed) {
    return (
      <div
        className="mt-2 flex justify-center"
        title={`Managing: ${tenantName}${role ? ` (${role})` : ""}`}
      >
        <span className="rounded-lg border border-brand-sage/60 bg-brand-ink/50 p-2.5 text-brand-bg">
          <FaBuilding size={18} />
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-brand-sage/60 bg-brand-ink/50 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-brand-secondary">
        Managing
      </p>
      <p className="text-sm font-medium text-brand-bg truncate" title={tenantName}>
        {tenantName}
      </p>
      {role ? <p className="text-xs text-brand-secondary mt-0.5">{role}</p> : null}
    </div>
  );
}
