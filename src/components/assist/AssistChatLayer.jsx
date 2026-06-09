"use client";

import "@/app/assist/cockpit.css";
import ChatDock from "@/components/assist/ChatDock";

/** Mounts the AE chat dock on brand-ui assist pages (dashboard). */
export default function AssistChatLayer({ pageContext = { entityType: "pipeline" } }) {
  return <ChatDock pageContext={pageContext} />;
}
