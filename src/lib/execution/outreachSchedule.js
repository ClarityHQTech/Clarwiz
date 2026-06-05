import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { contactCampaignInclude } from "@/lib/campaignDetail";

const DEFAULT_OUTREACH_TIME = "11:00";
const DEFAULT_TIMEZONE = "UTC";

function resolveRow(row, campaign) {
  const cc = row?.contactCampaign ?? row;
  return cc?.outreachDeliveryTime?.trim() || campaign.defaultOutreachTime?.trim() || DEFAULT_OUTREACH_TIME;
}

export function resolveDeliveryTime(contactCampaign, campaign) {
  return resolveRow(contactCampaign, campaign);
}

export function resolveTimezone(campaign) {
  const tz = campaign.outreachTimezone?.trim() || DEFAULT_TIMEZONE;
  if (!DateTime.now().setZone(tz).isValid) return DEFAULT_TIMEZONE;
  return tz;
}

function parseTimeParts(timeStr) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr?.trim() ?? "");
  if (!match) return { hour: 11, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, parseInt(match[1], 10))),
    minute: Math.min(59, Math.max(0, parseInt(match[2], 10))),
  };
}

export function computeNextOutreachAt({
  campaign,
  contactCampaign,
  prospect,
  fromDate = new Date(),
}) {
  const row = contactCampaign ?? prospect;
  const tz = resolveTimezone(campaign);
  const { hour, minute } = parseTimeParts(resolveRow(row, campaign));
  const base = DateTime.fromJSDate(fromDate, { zone: tz });
  let candidate = base.set({ hour, minute, second: 0, millisecond: 0 });
  if (candidate <= base) {
    candidate = candidate.plus({ days: 1 });
  }
  return candidate.toUTC().toJSDate();
}

export function todayInCampaignTz(campaign, ref = new Date()) {
  const tz = resolveTimezone(campaign);
  return DateTime.fromJSDate(ref, { zone: tz }).toISODate();
}

export function hasOutreachToday({ campaign, contactCampaign, prospect, commLogs = [] }) {
  const row = contactCampaign ?? prospect;
  const today = todayInCampaignTz(campaign);
  if (row.lastOutreachDate) {
    const last = DateTime.fromJSDate(row.lastOutreachDate, { zone: "utc" }).toISODate();
    if (last === today) return true;
  }

  const tz = resolveTimezone(campaign);
  const rowId = row.id;
  for (const log of commLogs) {
    const logCcId = log.contactCampaignId ?? log.prospectId;
    if (logCcId !== rowId) continue;
    if (!["sent", "delivered", "queued"].includes(log.status)) continue;
    const at = log.deliveredAt ?? log.sentAt;
    if (!at) continue;
    const logDay = DateTime.fromJSDate(at, { zone: tz }).toISODate();
    if (logDay === today) return true;
  }
  return false;
}

export async function seedCampaignContactSchedules(campaignId) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { contactCampaigns: true },
  });
  if (!campaign) return;

  for (const cc of campaign.contactCampaigns) {
    const nextAt = computeNextOutreachAt({ campaign, contactCampaign: cc });
    await prisma.contactCampaign.update({
      where: { id: cc.id },
      data: { nextScheduledOutreachAt: nextAt },
    });
  }
}

/** @deprecated use seedCampaignContactSchedules */
export const seedCampaignProspectSchedules = seedCampaignContactSchedules;

export async function planNextScheduledOutreach(contactCampaignId, campaign) {
  const cc = await prisma.contactCampaign.findUnique({
    where: { id: contactCampaignId },
  });
  if (!cc) return;

  const tz = resolveTimezone(campaign);
  const today = DateTime.now().setZone(tz).toISODate();

  const nextAt = computeNextOutreachAt({
    campaign,
    contactCampaign: cc,
    fromDate: DateTime.now().setZone(tz).plus({ days: 1 }).startOf("day").toJSDate(),
  });

  const lastDate = DateTime.fromISO(today, { zone: tz }).startOf("day").toUTC().toJSDate();

  await prisma.contactCampaign.update({
    where: { id: contactCampaignId },
    data: {
      lastOutreachDate: lastDate,
      nextScheduledOutreachAt: nextAt,
      status: cc.status === "PENDING" ? "IN_OUTREACH" : cc.status,
    },
  });
}

export function buildProspectSmartleadSchedule({ timezone, deliveryTime }) {
  const { hour, minute } = parseTimeParts(deliveryTime);
  const pad = (n) => String(n).padStart(2, "0");
  const startMin = hour * 60 + minute;
  const endMin = Math.min(startMin + 59, 23 * 60 + 59);
  const startHour = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`;
  const endHour = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;

  return {
    timezone: timezone || DEFAULT_TIMEZONE,
    days_of_the_week: [0, 1, 2, 3, 4, 5, 6],
    start_hour: startHour,
    end_hour: endHour,
    min_time_btw_emails: 3,
    max_new_leads_per_day: 1000,
  };
}

export const campaignExecutionInclude = {
  templates: { orderBy: [{ channel: "asc" }, { stage: "asc" }] },
  contactCampaigns: {
    include: {
      ...contactCampaignInclude,
      contact: {
        include: {
          businessUser: {
            include: {
              company: true,
              signals: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  },
  commLogs: { orderBy: { sentAt: "asc" } },
};
