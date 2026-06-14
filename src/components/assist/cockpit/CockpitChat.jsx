"use client";

import { useEffect, useState } from "react";
import "./cockpitChat.css";
import ChatDock from "./ChatDock";

/**
 * Cockpit — internal AE assist for deal workroom tasks and knowledge.
 * Preloads deal context from the DB when the deal page opens.
 */
export default function CockpitChat({ pageContext }) {
  const [ready, setReady] = useState(false);
  const dealId = pageContext?.id;

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;

    async function preload() {
      try {
        const res = await fetch(`/api/assist/deal/${dealId}/cockpit-context`);
        if (!cancelled && res.ok) setReady(true);
      } catch {
        /* chat still works; context loads on first message */
      }
    }

    preload();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  return <ChatDock pageContext={pageContext} contextReady={ready} />;
}
