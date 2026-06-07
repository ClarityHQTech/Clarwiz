/**
 * NBA action classifier — maps an NbaRecommendation to the UI/HubSpot action it
 * should drive: an email draft, a HubSpot meeting, a task, or collateral.
 *
 * Classification is a pure function of the NBA's `actionType`, `actionVerb`
 * (ontology verb, e.g. `Sales::Demo`), and `title` keywords. It is deliberately
 * forgiving: real NBAs carry noisy free-text titles, so keyword matching backs
 * up the structured fields.
 *
 * The keyword sets are exported so the UI and tests can reason about them.
 */

/** Title/verb keywords that indicate a MEETING action (demo, call, sync, …). */
export const MEETING_KEYWORDS = [
  "meeting",
  "meet",
  "demo",
  "call",
  "health check",
  "health-check",
  "qbr",
  "quarterly business review",
  "schedule",
  "sync",
  "kickoff",
  "kick-off",
  "discovery",
  "walkthrough",
  "review session",
  "live session",
];

/**
 * Title keywords that, on an otherwise email-shaped NBA, mark it as a
 * POST-MEETING follow-up (recap / notes / "after the call"). These stay email
 * actions but carry a `postMeeting` hint so the draft can be framed as a recap.
 */
export const POST_MEETING_KEYWORDS = [
  "follow up after",
  "follow-up after",
  "followup after",
  "after the meeting",
  "after the call",
  "after the demo",
  "post-meeting",
  "post meeting",
  "post-call",
  "post call",
  "recap",
  "meeting notes",
  "meeting summary",
  "debrief",
];

/** Title keywords that indicate a TASK action (internal to-do, not outbound). */
export const TASK_KEYWORDS = [
  "task",
  "to-do",
  "todo",
  "reminder",
  "prepare",
  "research",
  "update crm",
  "log ",
  "internal",
];

/** Title/asset keywords that indicate a COLLATERAL action (send a document). */
export const COLLATERAL_KEYWORDS = [
  "collateral",
  "one-pager",
  "one pager",
  "case study",
  "battlecard",
  "battle card",
  "deck",
  "pitch",
  "datasheet",
  "data sheet",
  "white paper",
  "whitepaper",
  "roi doc",
  "business case",
  "brochure",
  "send collateral",
];

function norm(v) {
  return typeof v === "string" ? v.toLowerCase() : "";
}

function hasAny(haystack, keywords) {
  return keywords.some((k) => haystack.includes(k));
}

/**
 * Classify an NBA into one of `"email" | "meeting" | "task" | "collateral"`.
 *
 * Returns `{ kind, postMeeting }` where `kind` is the action and `postMeeting`
 * is `true` when the NBA is an email recap of a meeting/call (so the follow-up
 * draft can be framed accordingly).
 *
 * Resolution order:
 *   1. Post-meeting recap phrases → email (postMeeting:true) — checked first so a
 *      "Follow up after the demo" email is NOT misread as a meeting.
 *   2. Structured `actionType` for the strong cases (schedule_meeting, …).
 *   3. `actionVerb` ontology hints (Sales::Demo, CustomerSuccess::QBR, …).
 *   4. Title keyword fallback.
 *   5. Default → email.
 */
export function classifyNbaAction(nba) {
  const actionType = norm(nba?.actionType);
  const actionVerb = norm(nba?.actionVerb);
  const title = norm(nba?.title);
  const verbAndTitle = `${actionVerb} ${title}`;

  // (1) Post-meeting recap email — wins over any meeting keyword in the title.
  if (hasAny(title, POST_MEETING_KEYWORDS)) {
    return { kind: "email", postMeeting: true };
  }

  // (2) Strong structured signals.
  if (actionType === "schedule_meeting") {
    return { kind: "meeting", postMeeting: false };
  }
  if (actionType === "send_collateral") {
    return { kind: "collateral", postMeeting: false };
  }
  if (actionType === "create_task") {
    // A task can still be a meeting if the verb/title says so (e.g. a CS verb).
    if (hasAny(verbAndTitle, MEETING_KEYWORDS)) {
      return { kind: "meeting", postMeeting: false };
    }
    return { kind: "task", postMeeting: false };
  }

  // (3) Ontology verb hints (e.g. Sales::Demo, CustomerSuccess::Health_Check/QBR).
  const verbForMatch = actionVerb.replace(/_/g, " ").replace(/::/g, " ");
  if (hasAny(verbForMatch, MEETING_KEYWORDS)) {
    return { kind: "meeting", postMeeting: false };
  }

  // (4) Title keyword fallback.
  if (hasAny(title, MEETING_KEYWORDS)) {
    return { kind: "meeting", postMeeting: false };
  }
  if (hasAny(title, COLLATERAL_KEYWORDS)) {
    return { kind: "collateral", postMeeting: false };
  }
  if (hasAny(title, TASK_KEYWORDS)) {
    return { kind: "task", postMeeting: false };
  }

  // (5) Default: an email draft (draft_email, clarify_technical, unknown).
  return { kind: "email", postMeeting: false };
}
