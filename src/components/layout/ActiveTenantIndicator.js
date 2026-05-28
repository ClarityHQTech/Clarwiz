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

  if (!user || user.isSuperadmin) {
    return null;
  }

  const activeMembership = user.memberships?.find(
    (m) => m.tenantId === user.tenantId
  );
  const tenantName =
    user.tenantName || activeMembership?.tenantName || "No workspace";
  const role = roleLabel(activeMembership?.role || user.tenantRole);

  if (!user.memberships?.length && !user.tenantId) {
    return null;
  }

  if (collapsed) {
    return (
      <div
        className="mt-2 flex justify-center"
        title={`Managing: ${tenantName}${role ? ` (${role})` : ""}`}
      >
        <span className="rounded-lg border border-sky-600/60 bg-sky-900/50 p-2.5 text-gray-200">
          <FaBuilding size={18} />
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-sky-600/60 bg-sky-900/50 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">
        Managing
      </p>
      <p className="text-sm font-medium text-white truncate" title={tenantName}>
        {tenantName}
      </p>
      {role ? <p className="text-xs text-gray-400 mt-0.5">{role}</p> : null}
    </div>
  );
}
