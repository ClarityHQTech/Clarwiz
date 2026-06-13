"use client";

import "./cockpitChat.css";
import ChatDock from "./ChatDock";

/**
 * Cockpit — the AE internal chat assist for deal workroom tasks and knowledge.
 * Cockpit UI is limited to this floating chat dock only.
 */
export default function CockpitChat({ pageContext }) {
  return <ChatDock pageContext={pageContext} />;
}
