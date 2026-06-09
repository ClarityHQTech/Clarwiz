"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import CampaignTemplatesPanel from "@/components/campaigns/CampaignTemplatesPanel";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import { STATUS_STYLES, ui } from "@/lib/brandUi";
import {
  localTimeToUtcHHmm,
  normalizeOutreachTimezone,
  OUTREACH_TIMEZONES,
  outreachTimezoneLabel,
} from "@/lib/outreachTimezones";
import { toast } from "sonner";
import {
  CAMPAIGN_CHANNELS,
  CHANNEL_LABELS,
} from "@/lib/campaignConstants";
import { DEFAULT_ENABLED_CHANNELS } from "@/lib/campaignChannels";

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
    >
      {status}
    </span>
  );
}

function SettingsSection({ title, description, children }) {
  return (
    <section className={`${ui.cardSurface} p-4 sm:p-5 space-y-4`}>
      <div>
        <h2 className={`${ui.titleSm} text-base`}>{title}</h2>
        {description && (
          <p className="text-sm text-brand-stone mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }) {
  return (
    <label className={`block ${ui.label} mb-1 normal-case tracking-normal`}>
      {children}
    </label>
  );
}

const Page = () => {
  const params = useParams();
  const id = params?.id;
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  const [nameEdit, setNameEdit] = useState("");
  const [descriptionEdit, setDescriptionEdit] = useState("");
  const [targetSegmentEdit, setTargetSegmentEdit] = useState("");
  const [goalsEdit, setGoalsEdit] = useState("");
  const [startDateEdit, setStartDateEdit] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const [outreachTzEdit, setOutreachTzEdit] = useState("UTC");
  const [defaultOutreachTimeEdit, setDefaultOutreachTimeEdit] = useState("11:00");
  const [savingOutreachSchedule, setSavingOutreachSchedule] = useState(false);

  const [calendlyUrlEdit, setCalendlyUrlEdit] = useState("");
  const [savingCalendlyUrl, setSavingCalendlyUrl] = useState(false);

  const [enabledChannelsEdit, setEnabledChannelsEdit] = useState([
    ...DEFAULT_ENABLED_CHANNELS,
  ]);
  const [savingChannels, setSavingChannels] = useState(false);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) {
        if (res.status === 404) setCampaign(null);
        throw new Error("Failed to load campaign");
      }
      const data = await res.json();
      setCampaign(data);
      setNameEdit(data.name ?? "");
      setDescriptionEdit(data.description ?? "");
      setTargetSegmentEdit(data.targetSegment ?? "");
      setGoalsEdit(data.goals ?? "");
      setStartDateEdit(data.startDate ? data.startDate.slice(0, 10) : "");
      setOutreachTzEdit(normalizeOutreachTimezone(data.outreachTimezone));
      setDefaultOutreachTimeEdit(data.defaultOutreachTime ?? "11:00");
      setCalendlyUrlEdit(data.calendlyBookingUrl ?? "");
      setEnabledChannelsEdit(
        data.enabledChannels?.length
          ? data.enabledChannels
          : [...DEFAULT_ENABLED_CHANNELS]
      );
    } catch (err) {
      toast.error(err.message);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchCampaign();
  }, [fetchCampaign]);

  const defaultSendTimeUtc = useMemo(
    () => localTimeToUtcHHmm(defaultOutreachTimeEdit, outreachTzEdit),
    [defaultOutreachTimeEdit, outreachTzEdit]
  );

  const outreachTimezoneName = useMemo(
    () => outreachTimezoneLabel(outreachTzEdit),
    [outreachTzEdit]
  );

  const saveDetails = async () => {
    if (!nameEdit.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    setSavingDetails(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameEdit.trim(),
          description: descriptionEdit.trim() || null,
          targetSegment: targetSegmentEdit.trim() || null,
          goals: goalsEdit.trim() || null,
          startDate: startDateEdit || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setCampaign(data);
      toast.success("Campaign details saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingDetails(false);
    }
  };

  const saveOutreachSchedule = async () => {
    setSavingOutreachSchedule(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreachTimezone: outreachTzEdit,
          defaultOutreachTime: defaultOutreachTimeEdit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setCampaign(data);
      toast.success("Outreach schedule saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingOutreachSchedule(false);
    }
  };

  const saveCalendlyUrl = async () => {
    setSavingCalendlyUrl(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendlyBookingUrl: calendlyUrlEdit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setCampaign(data);
      setCalendlyUrlEdit(data.calendlyBookingUrl ?? "");
      toast.success("Calendly URL saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingCalendlyUrl(false);
    }
  };

  const saveEnabledChannels = async () => {
    if (enabledChannelsEdit.length === 0) {
      toast.error("Select at least one channel");
      return;
    }
    setSavingChannels(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledChannels: enabledChannelsEdit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setCampaign(data);
      setEnabledChannelsEdit(data.enabledChannels ?? enabledChannelsEdit);
      toast.success("Outreach channels saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingChannels(false);
    }
  };

  const toggleChannel = (channel) => {
    setEnabledChannelsEdit((prev) => {
      if (prev.includes(channel)) {
        if (prev.length === 1) {
          toast.error("At least one channel must stay enabled");
          return prev;
        }
        return prev.filter((ch) => ch !== channel);
      }
      return [...prev, channel];
    });
  };

  if (loading) {
    return (
      <div className={`${ui.page} ${ui.container}`}>
        <p className={ui.body}>Loading settings…</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className={`${ui.page} ${ui.container}`}>
        <Link
          href="/campaigns"
          className={`inline-flex items-center gap-1 ${ui.link}`}
        >
          <HiOutlineArrowLeft className="h-4 w-4" />
          Back to campaigns
        </Link>
        <p className="mt-6 text-sm text-brand-stone">Campaign not found.</p>
      </div>
    );
  }

  return (
    <div className={`${ui.page} ${ui.container} space-y-6`}>
      <Link
        href={`/campaigns/${id}`}
        className={`inline-flex items-center gap-1 ${ui.link}`}
      >
        <HiOutlineArrowLeft className="h-4 w-4" />
        {campaign.name}
      </Link>

      <div className="flex items-center gap-2 flex-wrap">
        <h1 className={ui.titleSm}>Campaign settings</h1>
        <StatusBadge status={campaign.status} />
      </div>

      <SettingsSection
        title="Campaign details"
        description="Name, positioning, and goals for this campaign."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldLabel>Campaign name</FieldLabel>
            <input
              type="text"
              value={nameEdit}
              onChange={(e) => setNameEdit(e.target.value)}
              className={ui.inputSurface}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              rows={3}
              value={descriptionEdit}
              onChange={(e) => setDescriptionEdit(e.target.value)}
              className={`${ui.inputSurface} resize-y`}
            />
          </div>
          <div>
            <FieldLabel>Target segment</FieldLabel>
            <input
              type="text"
              value={targetSegmentEdit}
              onChange={(e) => setTargetSegmentEdit(e.target.value)}
              placeholder="Mid-market SaaS, US & UK"
              className={ui.inputSurface}
            />
          </div>
          <div>
            <FieldLabel>Goals</FieldLabel>
            <input
              type="text"
              value={goalsEdit}
              onChange={(e) => setGoalsEdit(e.target.value)}
              placeholder="Book 20 demos, 50 qualified replies"
              className={ui.inputSurface}
            />
          </div>
          <div>
            <FieldLabel>Start date</FieldLabel>
            <input
              type="date"
              value={startDateEdit}
              onChange={(e) => setStartDateEdit(e.target.value)}
              className={ui.inputSurface}
            />
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled={savingDetails}
            onClick={saveDetails}
            className={`${ui.btnPrimary} disabled:opacity-50`}
          >
            {savingDetails ? "Saving…" : "Save details"}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Outreach channels"
        description="Only selected channels are used for autopilot and co-pilot outreach. Others are strictly blocked by the execution layer."
      >
        <div className="flex flex-wrap gap-3">
          {CAMPAIGN_CHANNELS.map((channel) => {
            const checked = enabledChannelsEdit.includes(channel);
            return (
              <label
                key={channel}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                  checked
                    ? "border-brand-sage bg-brand-sage/15 text-brand-ink"
                    : "border-brand-secondary/40 bg-brand-surface text-brand-stone"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleChannel(channel)}
                  className="rounded border-brand-secondary/50 text-brand-dark focus:ring-brand-sage/40"
                />
                {CHANNEL_LABELS[channel]}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-brand-stone">
          Active:{" "}
          {enabledChannelsEdit.length
            ? enabledChannelsEdit.map((ch) => CHANNEL_LABELS[ch]).join(", ")
            : "None"}
        </p>
        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled={savingChannels || enabledChannelsEdit.length === 0}
            onClick={saveEnabledChannels}
            className={`${ui.btnPrimary} disabled:opacity-50`}
          >
            {savingChannels ? "Saving…" : "Save channels"}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Outreach schedule"
        description="Default timezone and send time for autopilot outreach. Times are stored in UTC."
      >
        <div className="space-y-2">
          <div className="grid sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
            <div>
              <FieldLabel>Outreach timezone</FieldLabel>
              <select
                value={outreachTzEdit}
                onChange={(e) => setOutreachTzEdit(e.target.value)}
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
              <FieldLabel>Default send time</FieldLabel>
              <input
                type="time"
                value={defaultOutreachTimeEdit}
                onChange={(e) => setDefaultOutreachTimeEdit(e.target.value)}
                className={ui.inputSurface}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                disabled={savingOutreachSchedule}
                onClick={saveOutreachSchedule}
                className={`w-full sm:w-auto ${ui.btnPrimary} disabled:opacity-50`}
              >
                {savingOutreachSchedule ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </div>
          <p className="text-xs text-brand-stone">
            {defaultOutreachTimeEdit} {outreachTimezoneName} · stored as{" "}
            {defaultSendTimeUtc} UTC
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Calendly booking URL"
        description="Used in stage 2+ outreach and tracked links. Connect Calendly in Integrations for auto-qualify on book."
      >
        {campaign.calendlyConnected === false && (
          <div className={ui.alertWarn}>
            Connect Calendly in{" "}
            <Link href="/integrations" className="font-medium underline text-brand-ink">
              Integrations
            </Link>{" "}
            to auto-qualify prospects when meetings are booked.
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <FieldLabel>Booking URL</FieldLabel>
            <input
              type="url"
              value={calendlyUrlEdit}
              onChange={(e) => setCalendlyUrlEdit(e.target.value)}
              placeholder="https://calendly.com/…"
              className={ui.inputSurface}
            />
          </div>
          <button
            type="button"
            disabled={savingCalendlyUrl}
            onClick={saveCalendlyUrl}
            className={`shrink-0 ${ui.btnPrimary} disabled:opacity-50`}
          >
            {savingCalendlyUrl ? "Saving…" : "Save URL"}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Communication templates"
        description="Email, LinkedIn, and WhatsApp templates used in this campaign."
      >
        <CampaignTemplatesPanel
          campaignId={campaign.id}
          templates={campaign.templates}
          onUpdated={setCampaign}
        />
      </SettingsSection>
    </div>
  );
};

export default DashboardLayout()(Page);
