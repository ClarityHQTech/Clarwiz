"use client";

import { useMemo } from "react";
import { ui } from "@/lib/brandUi";
import {
  localTimeToUtcHHmm,
  OUTREACH_TIMEZONES,
  outreachTimezoneLabel,
  utcHHmmToLocal,
} from "@/lib/outreachTimezones";

function FieldLabel({ children }) {
  return (
    <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
      {children}
    </label>
  );
}

export default function OutreachScheduleEditor({
  localTime,
  timezone,
  onLocalTimeChange,
  onTimezoneChange,
  timeLabel = "Send time",
  timezoneLabel = "Timezone",
}) {
  const utcTime = useMemo(
    () => localTimeToUtcHHmm(localTime, timezone),
    [localTime, timezone]
  );

  const timezoneName = useMemo(
    () => outreachTimezoneLabel(timezone),
    [timezone]
  );

  const handleTimezoneChange = (newTimezone) => {
    if (localTime && timezone && newTimezone !== timezone) {
      const utc = localTimeToUtcHHmm(localTime, timezone);
      onLocalTimeChange(utcHHmmToLocal(utc, newTimezone));
    }
    onTimezoneChange(newTimezone);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <FieldLabel>{timezoneLabel}</FieldLabel>
          <select
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className={ui.inputSurface}
          >
            {OUTREACH_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>{timeLabel}</FieldLabel>
          <input
            type="time"
            value={localTime}
            onChange={(e) => onLocalTimeChange(e.target.value)}
            className={ui.inputSurface}
          />
        </div>
      </div>
      <p className="text-xs text-brand-stone">
        {localTime} {timezoneName} · stored as {utcTime} UTC
      </p>
    </div>
  );
}
