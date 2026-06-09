"use client";

import { createContext, useContext, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import "@/app/assist/cockpit.css";
import ChatDock from "@/components/assist/ChatDock";

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "/assist" },
  { key: "collaterals", label: "Collateral", href: "/assist/collaterals" },
  { key: "log", label: "Log", href: "/assist/log" },
  { key: "settings", label: "Settings", href: "/assist/settings" },
];

/** Lets nested cards toggle / read the chat dock open-state via the topbar button. */
const ChatToggleCtx = createContext(null);
export function useChatToggle() {
  return useContext(ChatToggleCtx);
}

function SyncIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 0 0-15-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
      <path d="M21 21v-5h-5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/**
 * Shared cockpit chrome for every /assist page. Wrap a page body in:
 *   <AssistShell active="dashboard" crumbs={[…]} actions={…}>…</AssistShell>
 *
 * Renders the glass topbar (brand lockup, nav, sync/recompute/chat-toggle,
 * breadcrumbs) on the premium dark theme, the main content area, and mounts the
 * <ChatDock>. The chat-toggle button in the topbar and the dock share open-state.
 *
 * `onSync` (optional): wires the topbar Sync icon button to a handler.
 * `actions` render in the page header (e.g. Recompute / Promote / Generate).
 */
export default function AssistShell({
  active,
  crumbs = [],
  chatContext,
  onSync,
  syncing = false,
  topbarExtra,
  children,
}) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);

  const crumbItems = crumbs.length ? crumbs : ["Today"];

  return (
    <ChatToggleCtx.Provider value={{ chatOpen, setChatOpen, toggleChat: () => setChatOpen((v) => !v) }}>
      <div className="cockpit">
        <div className="cockpit-shell">
          <header className="ck-topbar">
            <NextLink href="/assist" className="ck-brand" style={{ textDecoration: "none" }}>
              <span className="ck-brand-mark" />
              <span className="ck-brand-name">Clarwiz</span>
              <span className="ck-brand-tag">AE Assist</span>
            </NextLink>

            <nav className="ck-nav">
              {NAV.map((n) => {
                const isActive =
                  active === n.key || (active == null && pathname === n.href);
                return (
                  <NextLink
                    key={n.key}
                    href={n.href}
                    className={`ck-nav-item${isActive ? " active" : ""}`}
                  >
                    {n.label}
                  </NextLink>
                );
              })}
            </nav>

            <div className="ck-crumbs">
              <span className="active">AE Cockpit</span>
              {crumbItems.map((c, i) => (
                <span key={i} style={{ display: "contents" }}>
                  <span className="sep">/</span>
                  <span className={i === crumbItems.length - 1 ? "active" : undefined}>{c}</span>
                </span>
              ))}
            </div>

            <div className="ck-topbar-actions">
              {topbarExtra}
              {onSync && (
                <button
                  type="button"
                  className="ck-icon-btn"
                  title="Sync HubSpot"
                  onClick={onSync}
                  disabled={syncing}
                >
                  <span className={syncing ? "ck-spin" : undefined} style={{ display: "grid" }}>
                    <SyncIcon />
                  </span>
                </button>
              )}
              <button
                type="button"
                className={`ck-icon-btn${chatOpen ? " active" : ""}`}
                title="AE Chat"
                onClick={() => setChatOpen((v) => !v)}
              >
                <ChatIcon />
              </button>
            </div>
          </header>

          <main className="ck-main">{children}</main>
        </div>

        <ChatDock pageContext={chatContext} open={chatOpen} onOpenChange={setChatOpen} />
      </div>
    </ChatToggleCtx.Provider>
  );
}
