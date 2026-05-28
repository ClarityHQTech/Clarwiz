"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
} from "@chakra-ui/react";

const TenantDetailsDrawer = ({
  open,
  loading,
  tenant,
  onClose,
  onTogglePayment,
  savingPayment,
  allowMemberManagement = false,
  onAssignMember,
  onRemoveMember,
  memberActionLoadingId,
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");

  return (
    <Drawer isOpen={open} placement="right" onClose={onClose} size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader borderBottomWidth="1px">Tenant Details</DrawerHeader>
        <DrawerBody py={4}>

        {loading ? (
          <p className="mt-6 text-sm text-gray-500">Loading details...</p>
        ) : tenant ? (
          <div className="mt-4 space-y-5 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Tenant</p>
              <p className="text-base font-medium text-gray-900">{tenant.name}</p>
              <p className="text-gray-500">
                Created: {new Date(tenant.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="rounded-md border border-gray-200 p-3">
              <p className="font-medium text-gray-900">Stats</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700">
                <p>Campaigns: {tenant.stats?.campaigns ?? 0}</p>
                <p>Prospects: {tenant.stats?.prospects ?? 0}</p>
                <p>LinkedIn: {tenant.stats?.hasLinkedIn ? "Yes" : "No"}</p>
                <p>Email: {tenant.stats?.hasEmail ? "Yes" : "No"}</p>
                <p>WhatsApp: {tenant.stats?.hasWhatsApp ? "Yes" : "No"}</p>
                <p>Calendly: {tenant.stats?.hasCalendly ? "Yes" : "No"}</p>
              </div>
            </div>

            <div className="rounded-md border border-gray-200 p-3">
              <p className="font-medium text-gray-900">Payment</p>
              <button
                type="button"
                onClick={onTogglePayment}
                disabled={savingPayment}
                className={`mt-2 rounded-md px-3 py-1.5 text-xs font-medium ${
                  tenant.payment_status
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                } disabled:opacity-70`}
              >
                {savingPayment
                  ? "Saving..."
                  : tenant.payment_status
                  ? "Payment: True"
                  : "Payment: False"}
              </button>
            </div>

            <div className="rounded-md border border-gray-200 p-3">
              <p className="font-medium text-gray-900">
                Assigned Users ({tenant.members?.length ?? 0})
              </p>
              {allowMemberManagement ? (
                <form
                  className="mt-3 flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!email.trim()) return;
                    onAssignMember?.({
                      email: email.trim(),
                      role,
                      scopes: [],
                    });
                    setEmail("");
                  }}
                >
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Add user by email"
                    className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded bg-cyan-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-800"
                    >
                      Assign user
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="mt-2 space-y-2">
                {(tenant.members || []).map((member) => (
                  <div key={member.id} className="rounded bg-gray-50 p-2">
                    <p className="font-medium text-gray-800">
                      {member.name || member.email}
                    </p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-600">Role: {member.role}</p>
                      {allowMemberManagement ? (
                        <button
                          type="button"
                          onClick={() => onRemoveMember?.(member)}
                          disabled={memberActionLoadingId === member.id}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 disabled:opacity-60"
                        >
                          {memberActionLoadingId === member.id
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(tenant.members || []).length === 0 ? (
                  <p className="text-xs text-gray-500">No users assigned.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-gray-500">Tenant details unavailable.</p>
        )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};

export default TenantDetailsDrawer;
