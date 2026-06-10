"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AssistPanel } from "../ui/AssistPanel";
import { ui } from "@/lib/brandUi";

export default function PostMeetingCard({ dealId }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const autoFetched = useRef(false);

  const fetchFromHubspot = async (silent = false) => {
    setFetching(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/meeting-notes`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        if (!silent) toast.error("Connect HubSpot in Integrations to fetch meeting notes.");
        return;
      }
      if (!res.ok || data.ok === false || !data.text) {
        if (!silent) {
          toast.message(
            "No meeting notes in HubSpot yet — connect the appointments scope if you expected some."
          );
        }
        return;
      }
      const incoming = data.text.trim();
      setNotes((prev) => {
        const existing = prev.trim();
        if (!existing) return incoming;
        if (existing.includes(incoming)) return prev;
        return `${existing}\n\n---\n${incoming}`;
      });
      const n = data.count ?? 0;
      toast.success(`Pulled ${n} meeting/note${n === 1 ? "" : "s"} from HubSpot`);
    } catch {
      if (!silent) toast.error("Failed to fetch meeting notes");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (autoFetched.current) return;
    autoFetched.current = true;
    if (!notes.trim()) fetchFromHubspot(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const save = async () => {
    const text = notes.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assist/deal/${dealId}/nba/post-meeting/post-meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 412) {
        toast.error("Connect HubSpot in Integrations to save meeting notes.");
        return;
      }
      if (!res.ok || data.ok === false) {
        if (data.reason === "write_scope") toast.warning("Your HubSpot token lacks note write scope.");
        else toast.error(data.error || "Failed to save notes");
        return;
      }
      const n = data.signalCount ?? 0;
      toast.success(
        n > 0
          ? `Notes saved · ${n} new signal${n === 1 ? "" : "s"} extracted`
          : "Notes saved to HubSpot"
      );
      setNotes("");
      router.refresh();
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AssistPanel title="Post-meeting notes" bodyClassName="px-4 pb-4">
      <p className={`${ui.body} mb-3`}>
        Paste call or meeting notes. They are saved to HubSpot and used to extract fresh signals.
      </p>
      <textarea
        className={`${ui.inputSurface} resize-y min-h-[120px]`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What was discussed, who said what, objections, next steps…"
        rows={5}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <button type="button" className={ui.btnSecondarySurface} onClick={() => fetchFromHubspot(false)} disabled={fetching}>
          {fetching ? "Fetching…" : "Fetch from HubSpot"}
        </button>
        <button type="button" className={ui.btnPrimary} onClick={save} disabled={saving || !notes.trim()}>
          {saving ? "Saving…" : "Save & extract signals"}
        </button>
      </div>
    </AssistPanel>
  );
}
