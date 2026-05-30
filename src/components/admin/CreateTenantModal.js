"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

const initialForm = {
  name: "",
  industry: "",
  about: "",
  website: "",
  adminEmail: "",
  payment_status: false,
};

export default function CreateTenantModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const createTenant = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Tenant name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry.trim() || undefined,
          about: form.about.trim() || undefined,
          website: form.website.trim() || undefined,
          adminEmail: form.adminEmail.trim() || undefined,
          payment_status: form.payment_status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to create tenant");
        return;
      }
      toast.success("Tenant created");
      setForm(initialForm);
      onCreated?.(data.tenant);
      onClose();
    } catch {
      toast.error("Failed to create tenant");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-tenant-title"
        className="relative w-full max-w-lg rounded-lg border border-brand-secondary/30 bg-white shadow-xl"
      >
        <form onSubmit={createTenant} className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="create-tenant-title" className="text-lg font-semibold text-brand-ink">
                Create tenant
              </h2>
              <p className="mt-1 text-sm text-brand-stone">
                Set up the workspace and assign a tenant admin.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-brand-stone hover:bg-brand-bg"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-brand-stone">Name *</span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Acme Corp"
                className="mt-1 w-full rounded-md border border-brand-secondary/40 px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-brand-stone">Industry</span>
              <input
                value={form.industry}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, industry: e.target.value }))
                }
                placeholder="e.g. SaaS, Healthcare"
                className="mt-1 w-full rounded-md border border-brand-secondary/40 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-brand-stone">Website</span>
              <input
                type="url"
                value={form.website}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, website: e.target.value }))
                }
                placeholder="https://example.com"
                className="mt-1 w-full rounded-md border border-brand-secondary/40 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-brand-stone">About</span>
              <textarea
                value={form.about}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, about: e.target.value }))
                }
                placeholder="Brief description of the company"
                rows={3}
                className="mt-1 w-full rounded-md border border-brand-secondary/40 px-3 py-2 text-sm resize-y"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-brand-stone">Admin email</span>
              <input
                type="email"
                value={form.adminEmail}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, adminEmail: e.target.value }))
                }
                placeholder="admin@company.com"
                className="mt-1 w-full rounded-md border border-brand-secondary/40 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-brand-stone">
              <input
                type="checkbox"
                checked={form.payment_status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    payment_status: e.target.checked,
                  }))
                }
              />
              Payment enabled
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-brand-secondary/40 px-4 py-2 text-sm font-medium text-brand-stone hover:bg-brand-bg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
