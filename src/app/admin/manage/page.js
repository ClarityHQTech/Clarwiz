"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";
import TenantTable from "@/components/admin/TenantTable";
import TenantDetailsDrawer from "@/components/admin/TenantDetailsDrawer";

const initialForm = { name: "", payment_status: false, adminEmail: "" };

const Page = () => {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [memberActionLoadingId, setMemberActionLoadingId] = useState(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const loadTenants = async () => {
    try {
      const res = await fetch("/api/admin/tenants?limit=50");
      const data = await res.json();
      if (!res.ok) return;
      setTenants(data.tenants || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const createTenant = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          payment_status: form.payment_status,
          adminEmail: form.adminEmail.trim() || undefined,
        }),
      });
      if (!res.ok) return;
      setForm(initialForm);
      await loadTenants();
    } finally {
      setCreating(false);
    }
  };

  const manageTenant = async (tenant) => {
    setActionLoadingId(tenant.id);
    try {
      router.push(`/manage-tenant?from=admin&tenantId=${tenant.id}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const openTenant = async (tenant) => {
    setSelectedTenantId(tenant.id);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`);
      const data = await res.json();
      if (!res.ok) return;
      setDetails(data);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedTenantId(null);
    setDetails(null);
  };

  const assignMember = async ({ email, role, permissions }) => {
    if (!details?.id) return;
    setMemberActionLoadingId("assign");
    try {
      const res = await fetch(`/api/admin/tenants/${details.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, permissions }),
      });
      if (!res.ok) return;
      await openTenant({ id: details.id });
      await loadTenants();
    } finally {
      setMemberActionLoadingId(null);
    }
  };

  const removeMember = async (member) => {
    if (!details?.id) return;
    setMemberActionLoadingId(member.id);
    try {
      const res = await fetch(
        `/api/admin/tenants/${details.id}/members/${member.id}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) return;
      await openTenant({ id: details.id });
      await loadTenants();
    } finally {
      setMemberActionLoadingId(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Manage</h1>
      <p className="text-sm text-gray-600">
        Create tenants and open their workspace management interface.
      </p>

      <form
        onSubmit={createTenant}
        className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
      >
        <h2 className="text-base font-medium">Create Tenant</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Tenant name"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={form.adminEmail}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, adminEmail: e.target.value }))
            }
            placeholder="Admin email (optional)"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.payment_status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, payment_status: e.target.checked }))
              }
            />
            Payment enabled
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-60"
        >
          {creating ? "Creating..." : "Create tenant"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading tenants...</p>
      ) : (
        <TenantTable
          tenants={tenants}
          actionLabel="Manage tenant"
          actionLoadingId={actionLoadingId}
          onAction={manageTenant}
          onSelectTenant={openTenant}
          selectedTenantId={selectedTenantId}
        />
      )}

      <TenantDetailsDrawer
        open={Boolean(selectedTenantId)}
        loading={detailsLoading}
        tenant={details}
        onClose={closeDrawer}
        onTogglePayment={async () => {
          if (!details?.id) return;
          setSavingPayment(true);
          try {
            const next = !details.payment_status;
            const res = await fetch(`/api/admin/tenants/${details.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payment_status: next }),
            });
            if (!res.ok) return;
            const data = await res.json();
            setDetails((prev) => ({
              ...prev,
              payment_status: data.payment_status ?? next,
            }));
            setTenants((prev) =>
              prev.map((t) =>
                t.id === details.id
                  ? { ...t, payment_status: data.payment_status ?? next }
                  : t
              )
            );
          } finally {
            setSavingPayment(false);
          }
        }}
        savingPayment={savingPayment}
        allowMemberManagement
        onAssignMember={assignMember}
        onRemoveMember={removeMember}
        memberActionLoadingId={memberActionLoadingId}
      />
    </div>
  );
};

export default AdminLayout()(Page);
