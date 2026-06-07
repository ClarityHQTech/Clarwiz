"use client";

import CockpitRecompute from "../cockpit/RecomputeButton";

/** Back-compat wrapper: deal recompute button in cockpit style. */
export default function RecomputeButton({ dealId, label = "Recompute", variant }) {
  return <CockpitRecompute id={dealId} scope="deal" label={label} variant={variant} />;
}
