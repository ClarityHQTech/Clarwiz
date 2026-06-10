"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * AE Chat Dock (C1) — floating dark copilot grounded in the AE's CRM context +
 * current page. Restyled to the AE Cockpit mockup. Thread + history live in
 * component state; each send POSTs recent history + pageContext to
 * /api/assist/chat (unchanged).
 *
 * Open-state is controlled by AssistShell (the topbar chat-toggle) via
 * `open` / `onOpenChange`; falls back to internal state if uncontrolled.
 *
 * Message shape: { id, role: 'user'|'assistant', content, status?: 'pending'|'error' }
 */
export default function ChatDock({ pageContext = { entityType: "pipeline" }, open, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = useCallback(
    (v) => {
      if (isControlled) onOpenChange?.(v);
      else setInternalOpen(v);
    },
    [isControlled, onOpenChange]
  );

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadIdRef = useRef(`t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const listEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);

  const buildHistory = useCallback(
    (extra = []) =>
      [...messages, ...extra]
        .filter((m) => m.status !== "pending" && m.status !== "error")
        .map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  const send = useCallback(
    async (text, opts = {}) => {
      const content = text.trim();
      if (!content || sending) return;

      const userMsg = { id: `u_${Date.now()}`, role: "user", content };
      const pendingId = `a_${Date.now()}`;
      const history = [...buildHistory(), { role: "user", content }];

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: "assistant", content: "", status: "pending" },
      ]);
      if (!opts.keepInput) setInput("");
      setSending(true);

      try {
        const res = await fetch("/api/assist/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            pageContext,
            threadId: threadIdRef.current,
          }),
        });
        if (!res.ok) throw new Error(`chat_failed_${res.status}`);
        const data = await res.json();
        const reply = typeof data?.reply === "string" ? data.reply : "";
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? { ...m, content: reply, status: undefined } : m))
        );
      } catch {
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== pendingId)
            .map((m) => (m.id === userMsg.id ? { ...m, status: "error" } : m))
        );
        setInput(content);
      } finally {
        setSending(false);
      }
    },
    [buildHistory, pageContext, sending]
  );

  const onSubmit = useCallback(
    (e) => {
      e?.preventDefault?.();
      send(input);
    },
    [input, send]
  );

  const retry = useCallback(
    (failed) => {
      setMessages((prev) => prev.filter((m) => m.id !== failed.id));
      send(failed.content, { keepInput: true });
    },
    [send]
  );

  const contextLabel =
    pageContext?.label ||
    (pageContext?.entityType && pageContext.entityType !== "pipeline"
      ? pageContext.entityType
      : "Pipeline");

  if (!isOpen) {
    return (
      <div className="ck-chat-root">
        <button
          type="button"
          className="ck-chat-fab"
          aria-label="Open AE Assist chat"
          onClick={() => setOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="ck-chat-root">
      <button
        type="button"
        className="ck-chat-backdrop"
        aria-label="Close chat"
        onClick={() => setOpen(false)}
      />
      <div className="ck-chat-dock" role="dialog" aria-label="AE Assist chat" aria-modal="true">
        <div className="ck-chat-header">
          <div className="ck-chat-header-main">
            <span className="ck-chat-title">Ask the cockpit</span>
            <span className="ck-chat-context">Context: {contextLabel}</span>
          </div>
          <button
            type="button"
            className="ck-drawer-close"
            style={{ position: "relative", top: 0, right: 0, flexShrink: 0 }}
            aria-label="Close chat"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>

      <div className="ck-chat-body">
        {messages.length === 0 && (
          <div className="ck-chat-msg ai">
            Grounded in your live HubSpot data + Clarwiz intelligence
            {contextLabel ? ` for ${contextLabel}` : ""}. What do you need?
          </div>
        )}
        {messages.map((m) => {
          const isUser = m.role === "user";
          const isError = m.status === "error";
          return (
            <div key={m.id} style={{ display: "contents" }}>
              <div className={`ck-chat-msg ${isUser ? "user" : "ai"}${isError ? " err" : ""}`}>
                {m.status === "pending" ? "Thinking…" : m.content}
              </div>
              {isError && (
                <div className="ck-chat-error">
                  Failed to send
                  <button type="button" onClick={() => retry(m)}>
                    Retry
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={listEndRef} />
      </div>

      <form className="ck-chat-input-row" onSubmit={onSubmit}>
        <input
          className="ck-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your pipeline…"
          disabled={sending}
          autoComplete="off"
        />
        <button type="submit" className="ck-chat-send" disabled={!input.trim() || sending}>
          ↵
        </button>
      </form>
      </div>
    </div>
  );
}
