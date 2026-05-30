"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions";

const PERMISSION_LABELS = {
  [PERMISSIONS.CAMPAIGN_CREATE]: "Campaign creation",
  [PERMISSIONS.CAMPAIGN_MANAGE]: "Campaign manage/edit/delete",
  [PERMISSIONS.CHANNEL_INTEGRATE]: "Channel integrations",
  [PERMISSIONS.ICP_CALL]: "ICP calling",
  [PERMISSIONS.MEMBER_MANAGE]: "Member management",
};

export default function TeamSection() {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [scopes, setScopes] = useState([
    PERMISSIONS.CAMPAIGN_CREATE,
  ]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/members");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load team");
      setMembers(data.members || []);
      setInvitations(data.pendingInvitations || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePermission = (key) => {
    setScopes((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenant/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: "MEMBER", scopes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed");
      toast.success(data.emailSent ? "Invitation sent" : "Invitation created");
      if (data.acceptUrl && !data.emailSent) {
        toast.info(`Share this link: ${data.acceptUrl}`);
      }
      setEmail("");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeMember = async (id) => {
    if (!confirm("Remove this team member?")) return;
    const res = await fetch(`/api/tenant/members/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to remove");
      return;
    }
    toast.success("Member removed");
    load();
  };

  if (loading) {
    return <p className="text-sm text-brand-stone">Loading team…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-ink">Team</h2>
        <p className="text-sm text-brand-stone mt-1">
          Invite users to run campaigns and integrations on behalf of your workspace.
        </p>
      </div>

      <form onSubmit={invite} className="rounded-lg border border-brand-secondary/30 p-4 space-y-4">
        <h3 className="font-medium text-brand-ink">Invite by email</h3>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          className="w-full rounded-lg border border-brand-secondary/40 px-3 py-2 text-sm"
          required
        />
        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-stone">Permissions</p>
          {ALL_PERMISSIONS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scopes.includes(key)}
                onChange={() => togglePermission(key)}
              />
              {PERMISSION_LABELS[key] || key}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send invitation"}
        </button>
      </form>

      <div>
        <h3 className="font-medium text-brand-ink mb-2">Members</h3>
        <ul className="divide-y divide-brand-secondary/30 rounded-lg border border-brand-secondary/30">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{m.name || m.email}</p>
                <p className="text-brand-stone">{m.email}</p>
                <p className="text-xs text-brand-steel mt-0.5">
                  {m.role === "ADMIN" ? "Admin" : `Assigned · ${m.scopes?.join(", ") || "no scopes"}`}
                </p>
              </div>
              {m.role !== "ADMIN" && (
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  className="text-red-600 hover:underline text-xs"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {invitations.length > 0 && (
        <div>
          <h3 className="font-medium text-brand-ink mb-2">Pending invitations</h3>
          <ul className="divide-y divide-brand-secondary/30 rounded-lg border border-brand-secondary/30">
            {invitations.map((i) => (
              <li key={i.id} className="px-4 py-3 text-sm text-brand-stone">
                {i.email} · expires {new Date(i.expiresAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
