"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CollateralPreviewFrame from "@/components/assist/collateral/CollateralPreviewFrame";
import { ui } from "@/lib/brandUi";

export default function CollateralLiveEditor({ documentId, onClose }) {
  const [title, setTitle] = useState("");
  const [compliance, setCompliance] = useState(null);
  const [versionCount, setVersionCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [bust, setBust] = useState(() => Date.now());

  const iframeSrc = useMemo(
    () => `/api/assist/document/${documentId}/html?v=${bust}`,
    [documentId, bust]
  );

  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/assist/document/${documentId}`);
        if (!res.ok) return;
        const { document } = await res.json();
        if (cancelled || !document) return;
        setTitle(document.title || "Collateral");
        setCompliance(document.compliance || null);
        setVersionCount(Array.isArray(document.versions) ? document.versions.length : 0);
      } catch {
        /* meta is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = useCallback(async () => {
    const text = instruction.trim();
    if (!text || sending) return;
    setError("");
    setSaved(false);
    setSending(true);
    setMessages((m) => [...m, { role: "user", text }]);
    setInstruction("");

    try {
      const res = await fetch(`/api/assist/document/${documentId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error === "edit_failed"
            ? "AI edit failed — try rephrasing."
            : data.error === "anthropic_not_configured"
              ? "Collateral editing isn't set up for this workspace yet."
              : data.error || "Could not apply the edit.";
        setError(msg);
        setMessages((m) => [...m, { role: "system", text: msg }]);
        return;
      }

      setCompliance(data.compliance || null);
      if (typeof data.versionCount === "number") setVersionCount(data.versionCount);
      setSaved(true);
      setBust(Date.now());
      setMessages((m) => [...m, { role: "assistant", text: "Applied and saved." }]);
    } catch {
      const msg = "Could not apply the edit.";
      setError(msg);
      setMessages((m) => [...m, { role: "system", text: msg }]);
    } finally {
      setSending(false);
    }
  }, [instruction, sending, documentId]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const downloadHtml = useCallback(async () => {
    try {
      const res = await fetch(`/api/assist/document/${documentId}/html?v=${Date.now()}`);
      if (!res.ok) return;
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "collateral").replace(/[^\w.-]+/g, "_")}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* download is best-effort */
    }
  }, [documentId, title]);

  const score = compliance?.score ?? null;
  const scoreClass =
    score == null
      ? "text-brand-stone"
      : Number(score) >= 80
        ? "text-brand-ink"
        : Number(score) >= 50
          ? "text-brand-terracotta"
          : "text-red-700";

  return (
    <div className="flex flex-col h-full min-h-[480px] bg-brand-surface text-brand-ink">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-secondary/25 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-ink truncate">{title || "Collateral"}</p>
          <p className="text-xs text-brand-stone">Live preview · chat to edit</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" className={ui.btnSecondarySurface} onClick={downloadHtml}>
            Download HTML
          </button>
          {onClose ? (
            <button type="button" className={ui.btnSecondary} onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <div className="flex-[1.5] min-h-[280px] lg:min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-brand-secondary/25">
          <CollateralPreviewFrame key={iframeSrc} src={iframeSrc} title="Collateral preview" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col bg-brand-bg/40 min-h-[320px]">
          <div className="flex flex-wrap gap-4 px-4 py-2.5 text-xs text-brand-stone border-b border-brand-secondary/20">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${score == null ? "bg-brand-steel" : Number(score) >= 80 ? "bg-brand-sage" : Number(score) >= 50 ? "bg-brand-gold" : "bg-red-500"}`} />
              Compliance: <strong className={scoreClass}>{score ?? "—"}</strong>
            </span>
            <span>Versions: {versionCount}</span>
            {saved ? <span className="text-brand-sage font-medium">✓ Saved</span> : null}
          </div>
          {compliance?.note ? (
            <p className="px-4 py-2 text-xs text-brand-stone border-b border-brand-secondary/20">{compliance.note}</p>
          ) : null}

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2">
            {messages.length === 0 ? (
              <p className="text-sm text-brand-stone leading-relaxed">
                Describe a change — e.g. &quot;make the headline punchier&quot;, &quot;add a security section&quot;.
                The preview updates and saves automatically.
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm leading-relaxed px-3 py-2 rounded-lg max-w-[92%] whitespace-pre-wrap ${
                  m.role === "user"
                    ? "self-end bg-brand-dark text-white"
                    : m.role === "system"
                      ? "self-start bg-red-50 text-red-800 border border-red-200/60"
                      : "self-start bg-brand-surface border border-brand-secondary/30 text-brand-ink"
                }`}
              >
                {m.text}
              </div>
            ))}
            {sending ? (
              <div className="self-start text-sm text-brand-stone px-3 py-2">Applying edit…</div>
            ) : null}
          </div>

          {error ? (
            <p className="px-4 py-2 text-xs text-red-700 bg-red-50 border-t border-red-200/60">{error}</p>
          ) : null}

          <div className="flex gap-2 p-3 border-t border-brand-secondary/25 shrink-0">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Tell the AI how to change this collateral…"
              rows={2}
              className={`flex-1 ${ui.inputSurface} resize-none text-sm`}
              disabled={sending}
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !instruction.trim()}
              className={`${ui.btnPrimary} self-stretch disabled:opacity-50`}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
