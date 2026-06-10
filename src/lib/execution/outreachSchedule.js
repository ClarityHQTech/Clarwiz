import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { campaignContactInclude } from "@/lib/campaignDetail";
import {
  normalizeOutreachTimezone,
  utcHHmmToLocal,
} from "@/lib/outreachTimezones";

const DEFAULT_OUTREACH_TIME = "11:00";
const DEFAULT_TIMEZONE = "UTC";

function resolveRow(row, campaign) {
  const cc = row?.campaignContact ?? row;
  return cc?.outreachDeliveryTime?.trim() || campaign.defaultOutreachTime?.trim() || DEFAULT_OUTREACH_TIME;
}

export function resolveDeliveryTime(campaignContact, campaign) {
  return resolveRow(campaignContact, campaign);
}

export function resolveTimezone(campaign) {
  return normalizeOutreachTimezone(campaign.outreachTimezone);
}

function parseTimeParts(timeStr) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr?.trim() ?? "");
  if (!match) return { hour: 11, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, parseInt(match[1], 10))),
    minute: Math.min(59, Math.max(0, parseInt(match[2], 10))),
  };
}

/** Stored delivery times are UTC HH:mm; nextScheduledOutreachAt is UTC. */
export function computeNextOutreachAt({
  campaign,
  campaignContact,
  prospect,
  fromDate = new Date(),
}) {
  const row = campaignContact ?? prospect;
  const { hour, minute } = parseTimeParts(resolveRow(row, campaign));
  const base = DateTime.fromJSDate(fromDate, { zone: "utc" });
  let candidate = base.set({ hour, minute, second: 0, millisecond: 0 });
  if (candidate <= base) {
    candidate = candidate.plus({ days: 1 });
  }
  return candidate.toUTC().toJSDate();
}

export function resolveDeliveryTimeLocal(campaignContact, campaign) {
  const utc = resolveDeliveryTime(campaignContact, campaign);
  return utcHHmmToLocal(utc, resolveTimezone(campaign));
}

export function todayInCampaignTz(campaign, ref = new Date()) {
  return DateTime.fromJSDate(ref, { zone: "utc" }).toISODate();
}

export function hasOutreachToday({ campaign, campaignContact, prospect, commLogs = [] }) {
  const row = campaignContact ?? prospect;
  const today = todayInCampaignTz(campaign);
  if (row.lastOutreachDate) {
    const last = DateTime.fromJSDate(row.lastOutreachDate, { zone: "utc" }).toISODate();
    if (last === today) return true;
  }

  const rowId = row.id;
  for (const log of commLogs) {
    const logCcId = log.campaignContactId ?? log.prospectId;
    if (logCcId !== rowId) continue;
    if (!["sent", "delivered", "queued"].includes(log.status)) continue;
    const at = log.deliveredAt ?? log.sentAt;
    if (!at) continue;
    const logDay = DateTime.fromJSDate(at, { zone: "utc" }).toISODate();
    if (logDay === today) return true;
  }
  return false;
}

export async function seedCampaignContactSchedules(campaignId) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { campaignContacts: true },
  });
  if (!campaign) return;

  for (const cc of campaign.campaignContacts) {
    const nextAt = computeNextOutreachAt({ campaign, campaignContact: cc });
    await prisma.campaignContact.update({
      where: { id: cc.id },
      data: { nextScheduledOutreachAt: nextAt },
    });
  }
}

/** @deprecated use seedCampaignContactSchedules */
export const seedCampaignProspectSchedules = seedCampaignContactSchedules;

export async function planNextScheduledOutreach(campaignContactId, campaign) {
  const cc = await prisma.campaignContact.findUnique({
    where: { id: campaignContactId },
  });
  if (!cc) return;

  const today = DateTime.now().setZone("utc").toISODate();

  const nextAt = computeNextOutreachAt({
    campaign,
    campaignContact: cc,
    fromDate: DateTime.now()
      .setZone("utc")
      .plus({ days: 1 })
      .startOf("day")
      .toJSDate(),
  });

  const lastDate = DateTime.fromISO(today, { zone: "utc" })
    .startOf("day")
    .toUTC()
    .toJSDate();

  await prisma.campaignContact.update({
    where: { id: campaignContactId },
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
  campaignContacts: {
    include: {
      ...campaignContactInclude,
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
