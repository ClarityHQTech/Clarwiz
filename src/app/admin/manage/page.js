"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import TenantTable from "@/components/admin/TenantTable";
import TenantDetailsDrawer from "@/components/admin/TenantDetailsDrawer";
import CreateTenantModal from "@/components/admin/CreateTenantModal";
import { useUser } from "@/context/UserContext";
import { useSwitchTenant } from "@/hooks/useSwitchTenant";

const Page = () => {
  const user = useUser();
  const { switchTenant } = useSwitchTenant();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [memberActionLoadingId, setMemberActionLoadingId] = useState(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
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

  const manageTenant = async (tenant) => {
    setActionLoadingId(tenant.id);
    try {
      await switchTenant(tenant.id, user?.tenantId, { redirectTo: "/dashboard" });
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
        Create tenants and open them in the standard workspace interface.
      </p>

      <div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800"
        >
          Create tenant
        </button>
      </div>

      <CreateTenantModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => loadTenants()}
      />

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
