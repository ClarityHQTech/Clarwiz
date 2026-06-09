"use client";

import CockpitRecompute from "../cockpit/RecomputeButton";

export default function RecomputeButton({ dealId, label = "Recompute", variant }) {
  return <CockpitRecompute id={dealId} scope="deal" label={label} primary={variant === "primary"} />;
}
