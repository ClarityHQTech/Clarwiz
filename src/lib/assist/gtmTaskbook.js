/** Parse a GTM step key (`pathIndex:stepIndex`) into numeric indices. */
export function parseGtmStepKey(stepKey) {
  const [pathRaw, stepRaw] = String(stepKey || "").split(":");
  const pathIndex = Number.parseInt(pathRaw, 10);
  const stepIndex = Number.parseInt(stepRaw, 10);
  if (!Number.isFinite(pathIndex) || !Number.isFinite(stepIndex)) return null;
  return { pathIndex, stepIndex };
}

/** Map DealGtmTask rows to a stepKey → record lookup for the taskbook UI. */
export function mapGtmTasksByStepKey(rows) {
  const map = {};
  for (const row of rows ?? []) {
    if (!row?.stepKey) continue;
    map[row.stepKey] = {
      id: row.id,
      stepKey: row.stepKey,
      subject: row.subject,
      hubspotTaskId: row.hubspotTaskId ?? null,
      status: row.status ?? "created",
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ?? null,
    };
  }
  return map;
}
