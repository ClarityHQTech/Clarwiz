"use client";

import RecomputeButton from "./RecomputeButton";
import { ui } from "@/lib/brandUi";

export default function EmptyInsight({ dealId }) {
  return (
    <div className={`${ui.cardSurface} p-10 text-center`}>
      <h2 className={`${ui.titleSm} mb-2`}>No analysis yet</h2>
      <p className={`${ui.body} max-w-md mx-auto mb-5`}>
        This deal hasn&apos;t been analyzed. Run the intelligence engine to generate a briefing,
        GTM paths, signals, and next best actions.
      </p>
      <RecomputeButton dealId={dealId} label="Analyze this deal" variant="primary" />
    </div>
  );
}
