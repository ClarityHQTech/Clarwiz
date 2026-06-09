"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * CollateralLiveEditor — live, chat-editable collateral.
 *
 * CONTRACT (imported by the UI agent):
 *   default export, props { documentId, onClose }.
 *
 * Layout: left = live preview in a sandboxed <iframe> whose src is
 * /api/assist/document/[id]/html (the stored self-contained HTML); right = a
 * chat box. Sending an instruction POSTs /api/assist/document/[id]/edit, then
 * cache-busts + reloads the iframe and shows the new compliance score, a
 * "saved" indicator, and the version count. Includes "Download HTML" + title.
 *
 * Styling is intentionally minimal/neutral (inline styles) so it reads well on a
 * dark modal surface — the UI agent owns global cockpit theming.
 */
export default function CollateralLiveEditor({ documentId, onClose }) {
  const [title, setTitle] = useState("");
  const [compliance, setCompliance] = useState(null);
  const [versionCount, setVersionCount] = useState(0);
  const [messages, setMessages] = useState([]); // { role, text }
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [bust, setBust] = useState(() => Date.now());

  const iframeSrc = useMemo(
    () => `/api/assist/document/${documentId}/html?v=${bust}`,
    [documentId, bust],
  );

  const scrollRef = useRef(null);

  // Load document meta (title, current compliance, version count) on mount.
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
      setBust(Date.now()); // cache-bust → iframe reloads the new HTML
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
  const scoreColor =
    score == null ? "#94a3b8" : Number(score) >= 80 ? "#34d399" : Number(score) >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ minWidth: 0 }}>
          <div style={S.title} title={title}>
            {title || "Collateral"}
          </div>
          <div style={S.subtitle}>Live preview · chat to edit</div>
        </div>
        <div style={S.headerActions}>
          <button type="button" style={S.secondaryBtn} onClick={downloadHtml}>
            Download HTML
          </button>
          {onClose && (
            <button type="button" style={S.secondaryBtn} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      {/* Body: preview | chat */}
      <div style={S.body}>
        <div style={S.previewPane}>
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title="Collateral preview"
            sandbox="allow-same-origin"
            style={S.iframe}
          />
        </div>

        <div style={S.chatPane}>
          <div style={S.statusRow}>
            <span style={S.statusItem}>
              <span style={{ ...S.dot, background: scoreColor }} />
              Compliance: <strong style={{ color: scoreColor }}>{score ?? "—"}</strong>
            </span>
            <span style={S.statusItem}>Versions: {versionCount}</span>
            {saved && <span style={{ ...S.statusItem, color: "#34d399" }}>✓ Saved</span>}
          </div>
          {compliance?.note && <div style={S.note}>{compliance.note}</div>}

          <div ref={scrollRef} style={S.messages}>
            {messages.length === 0 && (
              <div style={S.placeholder}>
                {`Describe a change — e.g. "make the headline punchier", "add a security section", "use a teal accent". The preview updates and saves automatically.`}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...S.msg,
                  ...(m.role === "user" ? S.msgUser : m.role === "system" ? S.msgSystem : S.msgAssistant),
                }}
              >
                {m.text}
              </div>
            ))}
            {sending && <div style={{ ...S.msg, ...S.msgAssistant }}>Applying edit…</div>}
          </div>

          {error && <div style={S.error}>{error}</div>}

          <div style={S.composer}>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Tell the AI how to change this collateral…"
              rows={2}
              style={S.textarea}
              disabled={sending}
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !instruction.trim()}
              style={{ ...S.sendBtn, opacity: sending || !instruction.trim() ? 0.5 : 1 }}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 480,
    background: "#0f172a",
    color: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 18px",
    borderBottom: "1px solid #1e293b",
  },
  title: { fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  subtitle: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  headerActions: { display: "flex", gap: 8, flexShrink: 0 },
  secondaryBtn: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  body: { display: "flex", flex: 1, minHeight: 0 },
  previewPane: { flex: "1 1 60%", minWidth: 0, background: "#ffffff", overflow: "hidden" },
  iframe: { width: "100%", height: "100%", border: "none", background: "#ffffff" },
  chatPane: {
    flex: "1 1 40%",
    minWidth: 300,
    display: "flex",
    flexDirection: "column",
    borderLeft: "1px solid #1e293b",
    background: "#0b1220",
  },
  statusRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    padding: "10px 14px",
    fontSize: 12.5,
    color: "#cbd5e1",
    borderBottom: "1px solid #1e293b",
  },
  statusItem: { display: "inline-flex", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  note: { padding: "8px 14px", fontSize: 12, color: "#94a3b8", borderBottom: "1px solid #1e293b" },
  messages: { flex: 1, minHeight: 0, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 },
  placeholder: { fontSize: 13, color: "#64748b", lineHeight: 1.5 },
  msg: { fontSize: 13, lineHeight: 1.45, padding: "8px 11px", borderRadius: 9, maxWidth: "92%", whiteSpace: "pre-wrap" },
  msgUser: { alignSelf: "flex-end", background: "#2563eb", color: "#fff" },
  msgAssistant: { alignSelf: "flex-start", background: "#1e293b", color: "#e2e8f0" },
  msgSystem: { alignSelf: "flex-start", background: "#3f1d1d", color: "#fecaca" },
  error: { padding: "8px 14px", fontSize: 12.5, color: "#fecaca", background: "#3f1d1d" },
  composer: { display: "flex", gap: 8, padding: 12, borderTop: "1px solid #1e293b" },
  textarea: {
    flex: 1,
    resize: "none",
    background: "#0f172a",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  sendBtn: {
    alignSelf: "stretch",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
