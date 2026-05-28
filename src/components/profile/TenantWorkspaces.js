"use client";

import { useUser } from "@/context/UserContext";
import { useSwitchTenant } from "@/hooks/useSwitchTenant";

const roleLabel = (role) => {
  if (role === "ADMIN") return "Admin";
  if (role === "MEMBER") return "Member";
  return role || "Member";
};

export default function TenantWorkspaces() {
  const user = useUser();
  const { switchTenant, loading } = useSwitchTenant();

  if (!user || user.isSuperadmin || !user.memberships?.length) {
    return null;
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Your workspaces</h2>
      <p className="mt-1 text-sm text-gray-600">
        Select a workspace to manage. Your role may differ per workspace.
      </p>
      <ul className="mt-4 space-y-2">
        {user.memberships.map((m) => {
          const isActive = m.tenantId === user.tenantId;
          return (
            <li key={m.tenantId}>
              <button
                type="button"
                onClick={() => switchTenant(m.tenantId, user.tenantId)}
                disabled={loading || isActive}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? "border-sky-600 bg-sky-50 ring-1 ring-sky-600"
                    : "border-gray-200 bg-white hover:border-sky-300 hover:bg-gray-50"
                } disabled:cursor-default`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {m.tenantName}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {roleLabel(m.role)}
                      {!m.payment_status && (
                        <span className="text-amber-600"> · Subscription inactive</span>
                      )}
                    </p>
                  </div>
                  {isActive && (
                    <span className="shrink-0 rounded-full bg-sky-700 px-2.5 py-0.5 text-xs font-medium text-white">
                      Active
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
