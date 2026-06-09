"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import "@/app/assist/cockpit.css";
import ChatDock from "@/components/assist/ChatDock";
import { ui } from "@/lib/brandUi";

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
 * Cockpit chrome for deal/lead workrooms. Renders the dark cockpit topbar with
 * back link, breadcrumbs, sync, and chat toggle — plus the ChatDock.
 */
export default function AssistShell({
  crumbs = [],
  chatContext,
  onSync,
  syncing = false,
  topbarExtra,
  children,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const crumbItems = crumbs.length ? crumbs : ["Workroom"];

  return (
    <ChatToggleCtx.Provider value={{ chatOpen, setChatOpen, toggleChat: () => setChatOpen((v) => !v) }}>
      <div className="cockpit">
        <div className="cockpit-shell">
          <header className="ck-topbar">
            <Link href="/assist" className="ck-brand" style={{ textDecoration: "none" }}>
              <span className="ck-brand-mark" />
              <span className="ck-brand-name">Clarwiz</span>
              <span className="ck-brand-tag">AE Cockpit</span>
            </Link>

            <div className="ck-crumbs">
              <Link href="/assist" className={`inline-flex items-center gap-1 ${ui.link}`} style={{ color: "inherit" }}>
                <HiOutlineArrowLeft className="h-3.5 w-3.5" />
                AE Assist
              </Link>
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
