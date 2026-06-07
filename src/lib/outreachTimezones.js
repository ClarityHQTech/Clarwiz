import { DateTime } from "luxon";

export const OUTREACH_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Kolkata", label: "IST" },
];

export const OUTREACH_TIMEZONE_VALUES = OUTREACH_TIMEZONES.map((t) => t.value);

const TIMEZONE_ALIASES = {
  IST: "Asia/Kolkata",
};

function parseTimeParts(timeStr) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr?.trim() ?? "");
  if (!match) return { hour: 11, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, parseInt(match[1], 10))),
    minute: Math.min(59, Math.max(0, parseInt(match[2], 10))),
  };
}

export function normalizeOutreachTimezone(timezone) {
  const trimmed = timezone?.trim();
  if (!trimmed) return "UTC";
  if (OUTREACH_TIMEZONE_VALUES.includes(trimmed)) return trimmed;
  if (TIMEZONE_ALIASES[trimmed]) return TIMEZONE_ALIASES[trimmed];
  return "UTC";
}

export function isAllowedOutreachTimezone(timezone) {
  const trimmed = timezone?.trim();
  if (!trimmed) return false;
  if (TIMEZONE_ALIASES[trimmed]) return true;
  return OUTREACH_TIMEZONE_VALUES.includes(trimmed);
}

export function localTimeToUtcHHmm(localHHmm, timezone) {
  const { hour, minute } = parseTimeParts(localHHmm);
  const zone = normalizeOutreachTimezone(timezone);
  const dt = DateTime.fromObject({ hour, minute }, { zone });
  if (!dt.isValid) {
    return DateTime.fromObject({ hour: 11, minute: 0 }, { zone: "UTC" })
      .toUTC()
      .toFormat("HH:mm");
  }
  return dt.toUTC().toFormat("HH:mm");
}

export function utcHHmmToLocal(utcHHmm, timezone) {
  const { hour, minute } = parseTimeParts(utcHHmm);
  const zone = normalizeOutreachTimezone(timezone);
  const dt = DateTime.fromObject({ hour, minute }, { zone: "utc" });
  return dt.setZone(zone).toFormat("HH:mm");
}

export function outreachTimezoneLabel(timezone) {
  const normalized = normalizeOutreachTimezone(timezone);
  return (
    OUTREACH_TIMEZONES.find((t) => t.value === normalized)?.label ?? normalized
  );
}
