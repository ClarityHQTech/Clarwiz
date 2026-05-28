"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/react";

const Page = () => {
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedRole, setSelectedRole] = useState("MEMBER");
  const [savingKey, setSavingKey] = useState(null);

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users?limit=100");
      const data = await res.json();
      if (!res.ok) return;
      setUsers(data.users || []);
      if (selectedUserId) {
        const updated = (data.users || []).find((u) => u.id === selectedUserId);
        setSelectedUser(updated || null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTenants = async () => {
    const res = await fetch("/api/admin/tenants?limit=200");
    const data = await res.json();
    if (!res.ok) return;
    setTenants(data.tenants || []);
  };

  useEffect(() => {
    loadUsers();
    loadTenants();
  }, []);

  const openUserDrawer = (user) => {
    setSelectedUserId(user.id);
    setSelectedUser(user);
    setSelectedTenantId("");
    setSelectedRole("MEMBER");
  };

  const closeUserDrawer = () => {
    setSelectedUserId(null);
    setSelectedUser(null);
    setSelectedTenantId("");
  };

  const updateMembershipRole = async (membership, role) => {
    const key = `role-${membership.membershipId}`;
    setSavingKey(key);
    try {
      const res = await fetch(
        `/api/admin/tenants/${membership.tenantId}/members/${membership.membershipId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );
      if (!res.ok) return;
      await loadUsers();
    } finally {
      setSavingKey(null);
    }
  };

  const removeMembership = async (membership) => {
    const key = `remove-${membership.membershipId}`;
    setSavingKey(key);
    try {
      const res = await fetch(
        `/api/admin/tenants/${membership.tenantId}/members/${membership.membershipId}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      await loadUsers();
    } finally {
      setSavingKey(null);
    }
  };

  const addToTenant = async () => {
    if (!selectedUser?.email || !selectedTenantId) return;
    setSavingKey("add-membership");
    try {
      const res = await fetch(`/api/admin/tenants/${selectedTenantId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: selectedUser.email,
          role: selectedRole,
          scopes: [],
        }),
      });
      if (!res.ok) return;
      setSelectedTenantId("");
      await loadUsers();
    } finally {
      setSavingKey(null);
    }
  };

  const availableTenants = tenants.filter(
    (tenant) => !selectedUser?.tenants?.some((m) => m.tenantId === tenant.id)
  );

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-sm text-gray-600">
        All platform users are listed here with tenant memberships and roles.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading users...</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Superadmin</th>
                <th className="px-4 py-3 text-left font-medium">Joined Platform</th>
                <th className="px-4 py-3 text-left font-medium">Tenants & Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-gray-100 align-top cursor-pointer hover:bg-gray-50"
                  onClick={() => openUserDrawer(user)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{user.name || "No name"}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        user.is_superadmin
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {user.is_superadmin ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {user.tenants?.length ? (
                      <div className="space-y-2">
                        {user.tenants.map((tenant) => (
                          <div
                            key={tenant.membershipId}
                            className="rounded border border-gray-200 bg-gray-50 px-2.5 py-2"
                          >
                            <p className="font-medium text-gray-800">{tenant.tenantName}</p>
                            <p className="text-xs text-gray-600">
                              Role: {tenant.role} · Joined:{" "}
                              {tenant.joinedAt
                                ? new Date(tenant.joinedAt).toLocaleDateString()
                                : "-"}
                            </p>
                            {tenant.scopes?.length ? (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Scopes: {tenant.scopes.join(", ")}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">
                        No tenant memberships
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <Drawer isOpen={Boolean(selectedUserId)} placement="right" onClose={closeUserDrawer} size="md">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">User Details</DrawerHeader>
          <DrawerBody py={4}>
            {!selectedUser ? (
              <p className="text-sm text-gray-500">No user selected.</p>
            ) : (
              <div className="space-y-5 text-sm">
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedUser.name || "No name"}
                  </p>
                  <p className="text-gray-500">{selectedUser.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Joined platform: {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="rounded-md border border-gray-200 p-3 space-y-3">
                  <p className="font-medium text-gray-900">Add to Tenant</p>
                  <div className="space-y-2">
                    <select
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Select tenant</option>
                      {availableTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button
                      type="button"
                      onClick={addToTenant}
                      disabled={!selectedTenantId || savingKey === "add-membership"}
                      className="rounded bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800 disabled:opacity-60"
                    >
                      {savingKey === "add-membership" ? "Adding..." : "Add tenant membership"}
                    </button>
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 p-3 space-y-3">
                  <p className="font-medium text-gray-900">
                    Tenant Memberships ({selectedUser.tenants?.length || 0})
                  </p>
                  {(selectedUser.tenants || []).map((membership) => (
                    <div
                      key={membership.membershipId}
                      className="rounded border border-gray-200 bg-gray-50 p-2.5"
                    >
                      <p className="font-medium text-gray-800">{membership.tenantName}</p>
                      <p className="text-xs text-gray-500 mb-2">
                        Joined:{" "}
                        {membership.joinedAt
                          ? new Date(membership.joinedAt).toLocaleDateString()
                          : "-"}
                      </p>
                      <div className="flex items-center gap-2">
                        <select
                          value={membership.role}
                          onChange={(e) =>
                            updateMembershipRole(membership, e.target.value)
                          }
                          disabled={savingKey === `role-${membership.membershipId}`}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        >
                          <option value="MEMBER">MEMBER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMembership(membership)}
                          disabled={savingKey === `remove-${membership.membershipId}`}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 disabled:opacity-60"
                        >
                          {savingKey === `remove-${membership.membershipId}`
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {(selectedUser.tenants || []).length === 0 ? (
                    <p className="text-xs text-gray-500">No tenant memberships.</p>
                  ) : null}
                </div>
              </div>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default AdminLayout()(Page);
