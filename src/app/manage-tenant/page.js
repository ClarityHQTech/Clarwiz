"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "Campaigns" },
  { id: "integrations", label: "Integrations" },
  { id: "team", label: "Team" },
  { id: "settings", label: "Settings" },
];

const Page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");
  const [activeTab, setActiveTab] = useState("overview");

  const [tenant, setTenant] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [integrations, setIntegrations] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(false);

  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState("ASSIGNED_USER");
  const [memberActionLoading, setMemberActionLoading] = useState(null);

  const refreshTenant = useCallback(async () => {
    if (!tenantId) return;
    setLoadingTenant(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`);
      const data = await res.json();
      if (!res.ok) return;
      setTenant(data);
    } finally {
      setLoadingTenant(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refreshTenant();
  }, [refreshTenant]);

  useEffect(() => {
    const loadSection = async () => {
      if (!tenantId) return;
      if (activeTab === "campaigns" || activeTab === "integrations") {
        setSectionLoading(true);
      }
      try {
        if (activeTab === "campaigns") {
          const res = await fetch(`/api/admin/tenants/${tenantId}/campaigns`);
          const data = await res.json();
          if (res.ok) setCampaigns(data.campaigns || []);
          return;
        }
        if (activeTab === "integrations") {
          const res = await fetch(`/api/admin/tenants/${tenantId}/integrations`);
          const data = await res.json();
          if (res.ok) setIntegrations(data);
        }
      } finally {
        setSectionLoading(false);
      }
    };
    loadSection();
  }, [activeTab, tenantId]);

  const integrationRows = useMemo(() => {
    if (!integrations) return [];
    return [
      { key: "LinkedIn", data: integrations.linkedin },
      { key: "Email", data: integrations.email },
      { key: "WhatsApp", data: integrations.whatsapp },
      { key: "Calendly", data: integrations.calendly },
    ];
  }, [integrations]);

  const assignMember = async (e) => {
    e.preventDefault();
    if (!tenantId || !assignEmail.trim()) return;
    setMemberActionLoading("assign");
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: assignEmail.trim(),
          role: assignRole,
          permissions: [],
        }),
      });
      if (!res.ok) return;
      setAssignEmail("");
      await refreshTenant();
    } finally {
      setMemberActionLoading(null);
    }
  };

  const removeMember = async (membershipId) => {
    if (!tenantId) return;
    setMemberActionLoading(membershipId);
    try {
      const res = await fetch(
        `/api/admin/tenants/${tenantId}/members/${membershipId}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      await refreshTenant();
    } finally {
      setMemberActionLoading(null);
    }
  };

  return (
    <div className="p-8 space-y-5">
      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-cyan-900">Tenant Admin Workspace</h1>
            <p className="mt-1 text-sm text-cyan-800">
              Manage this tenant from admin only, without switching to user interface.
            </p>
          </div>
          <Link
            href="/admin/manage"
            className="inline-flex rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800"
          >
            Back to Admin
          </Link>
        </div>
      </div>

      {!tenantId ? (
        <p className="text-sm text-red-600">Missing tenantId in URL.</p>
      ) : loadingTenant ? (
        <p className="text-sm text-gray-500">Loading tenant...</p>
      ) : !tenant ? (
        <p className="text-sm text-red-600">Tenant not found.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    activeTab === tab.id
                      ? "bg-cyan-700 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "overview" ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">{tenant.name}</h2>
              <p className="text-sm text-gray-600">
                Tenant ID: <span className="font-mono text-xs">{tenant.id}</span>
              </p>
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-gray-500">Campaigns</p>
                  <p className="text-lg font-semibold">{tenant.stats?.campaigns ?? 0}</p>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-gray-500">Prospects</p>
                  <p className="text-lg font-semibold">{tenant.stats?.prospects ?? 0}</p>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <p className="text-gray-500">Team Members</p>
                  <p className="text-lg font-semibold">{tenant.members?.length ?? 0}</p>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "campaigns" ? (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              {sectionLoading ? (
                <p className="p-4 text-sm text-gray-500">Loading campaigns...</p>
              ) : (
                <div>
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      Open admin-side campaign workspace to create campaigns, upload prospects, manage templates, and run outreach.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/manage-tenant/campaigns?tenantId=${tenantId}`)
                      }
                      className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800"
                    >
                      Open campaign workspace
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Prospects</th>
                        <th className="px-4 py-3 text-left font-medium">Sent</th>
                        <th className="px-4 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-t border-gray-100">
                          <td className="px-4 py-3">{campaign.name}</td>
                          <td className="px-4 py-3">{campaign.status}</td>
                          <td className="px-4 py-3">{campaign.prospectCount}</td>
                          <td className="px-4 py-3">{campaign.sentCount}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/manage-tenant/campaigns?tenantId=${tenantId}&campaignId=${campaign.id}`
                                )
                              }
                              className="rounded border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700"
                            >
                              Manage campaign
                            </button>
                          </td>
                        </tr>
                      ))}
                      {campaigns.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No campaigns found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "integrations" ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              {sectionLoading ? (
                <p className="text-sm text-gray-500">Loading integrations...</p>
              ) : (
                <div className="space-y-3">
                  {integrationRows.map((row) => (
                    <div
                      key={row.key}
                      className="rounded border border-gray-200 p-3 text-sm"
                    >
                      <p className="font-medium text-gray-900">{row.key}</p>
                      {row.data ? (
                        <p className="text-gray-600 mt-1">
                          Status: {row.data.status || "connected"}{" "}
                          {row.data.connectedAt
                            ? `· Connected ${new Date(row.data.connectedAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-gray-500 mt-1">Not connected</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "team" ? (
            <div className="space-y-4">
              <form
                onSubmit={assignMember}
                className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
              >
                <h3 className="text-base font-medium">Assign User</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="email"
                    value={assignEmail}
                    onChange={(e) => setAssignEmail(e.target.value)}
                    placeholder="user@company.com"
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                  <select
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="ASSIGNED_USER">ASSIGNED_USER</option>
                    <option value="TENANT_ADMIN">TENANT_ADMIN</option>
                  </select>
                  <button
                    type="submit"
                    disabled={memberActionLoading === "assign"}
                    className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-60"
                  >
                    {memberActionLoading === "assign" ? "Assigning..." : "Assign user"}
                  </button>
                </div>
              </form>

              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">User</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tenant.members || []).map((member) => (
                      <tr key={member.id} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{member.name || member.email}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </td>
                        <td className="px-4 py-3">{member.role}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeMember(member.id)}
                            disabled={memberActionLoading === member.id}
                            className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 disabled:opacity-60"
                          >
                            {memberActionLoading === member.id ? "Removing..." : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              <h3 className="text-base font-medium text-gray-900">Tenant Settings</h3>
              <p className="text-sm text-gray-600">Update tenant name and payment state.</p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const next = !tenant.payment;
                    const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ payment: next }),
                    });
                    if (!res.ok) return;
                    setTenant((prev) => ({ ...prev, payment: next }));
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    tenant.payment
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {tenant.payment ? "Payment: True" : "Payment: False"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminLayout()(Page);
