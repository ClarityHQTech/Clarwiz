"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useUser } from "@/context/UserContext";

const emptyForm = { name: "", industry: "", about: "", website: "" };

export default function TenantDetailsSection() {
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/details");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load workspace details");
      setCanEdit(Boolean(data.canEdit));
      setForm({
        name: data.name || "",
        industry: data.industry || "",
        about: data.about || "",
        website: data.website || "",
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!form.name.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tenant/details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry.trim(),
          about: form.about.trim(),
          website: form.website.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save workspace details");
      toast.success("Workspace details saved");
      setForm({
        name: data.name || "",
        industry: data.industry || "",
        about: data.about || "",
        website: data.website || "",
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user?.tenantId) {
    return null;
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Loading workspace details...</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Workspace details</h2>
      <p className="mt-1 text-sm text-gray-600">
        {canEdit
          ? "Company information for your active workspace."
          : "Company information for your active workspace (read only)."}
      </p>

      {canEdit ? (
        <form onSubmit={save} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Name</span>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">Industry</span>
            <input
              value={form.industry}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, industry: e.target.value }))
              }
              placeholder="e.g. SaaS, Healthcare"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">Website</span>
            <input
              type="url"
              value={form.website}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, website: e.target.value }))
              }
              placeholder="https://example.com"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">About</span>
            <textarea
              value={form.about}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, about: e.target.value }))
              }
              rows={4}
              placeholder="Brief description of your company"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-y"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save details"}
          </button>
        </form>
      ) : (
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-700">Name</dt>
            <dd className="mt-0.5 text-gray-900">{form.name || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700">Industry</dt>
            <dd className="mt-0.5 text-gray-900">{form.industry || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700">Website</dt>
            <dd className="mt-0.5 text-gray-900">
              {form.website ? (
                <a
                  href={form.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:underline"
                >
                  {form.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-700">About</dt>
            <dd className="mt-0.5 text-gray-900 whitespace-pre-wrap">
              {form.about || "—"}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
