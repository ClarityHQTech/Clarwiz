import {
  linkupCheckInvitation,
  linkupGetConversation,
  linkupListConnections,
} from "@/lib/linkupApi";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import {
  linkedInUrlsMatch,
  normalizeLinkedInProfileUrl,
} from "@/lib/linkedinProfileUrl";
import {
  applyLinkedInConnectedEngagement,
  applyLinkedInReplyEngagement,
} from "@/lib/execution/applyChannelEngagement";

const PENDING_STATUSES = ["planned", "queued", "sent", "delivered"];

async function fetchAllConnections(accountId) {
  const connections = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await linkupListConnections({
      accountId,
      count: 100,
      offset,
    });
    const batch = result.data?.connections ?? [];
    connections.push(...batch);

    const pagination = result.data?.pagination;
    if (pagination?.has_more && pagination.next_offset != null) {
      offset = pagination.next_offset;
    } else {
      hasMore = false;
    }
    if (batch.length === 0) hasMore = false;
    if (connections.length >= 500) hasMore = false;
  }

  return connections;
}

function findConnectionForProspect(connections, prospect) {
  if (!prospect.linkedinUrl) return null;
  return (
    connections.find((c) =>
      linkedInUrlsMatch(c.profile_url, prospect.linkedinUrl)
    ) ?? null
  );
}

/** Baseline time for "reply after our outbound" — prefer actual delivery time. */
function outboundBaselineMs(log) {
  const t = log.deliveredAt ?? log.sentAt;
  return t ? new Date(t).getTime() : 0;
}

function isInboundTextMessage(message, prospect) {
  if (!message?.text?.trim()) return false;
  if (message.message_type && message.message_type !== "TEXT") return false;

  const senderUrl = message.sender_info?.profile_url;
  if (senderUrl && linkedInUrlsMatch(senderUrl, prospect.linkedinUrl)) {
    return true;
  }

  return false;
}

/**
 * Most recent prospect reply after our outbound, via get_conversation (profile_url).
 * @see https://docs.linkupapi.com/api-reference/v2/messages/get-conversation
 */
function findProspectReplyInMessages(messages, prospect, baselineMs) {
  for (const message of messages ?? []) {
    const ts = message.timestamp ? Number(message.timestamp) : 0;
    if (ts && ts <= baselineMs) break;

    if (isInboundTextMessage(message, prospect)) {
      return { text: message.text.trim(), timestamp: ts || Date.now() };
    }
  }
  return null;
}

async function fetchProspectConversation(accountId, prospect) {
  const profileUrl = normalizeLinkedInProfileUrl(prospect.linkedinUrl);
  if (!profileUrl) return null;

  return linkupGetConversation({
    accountId,
    profileUrl,
    count: 10,
  });
}

/**
 * Track LinkedIn connection accepts and message replies for pending comm logs.
 * Connections: batch list_connections + check_invitation fallback.
 * Replies: get_conversation per prospect (not list_inbox).
 */
export async function checkLinkedInEngagementForCampaign({
  userId,
  campaignId,
  prospects,
  pendingLogsByProspect,
  linkedInLogsByProspect,
}) {
  const integration = await getLinkedInIntegrationWithAccountId(userId);
  if (
    !integration ||
    integration.status !== "connected" ||
    !integration.linkupAccountIdPlain
  ) {
    return {
      results: [],
      skipped: true,
      reason: "linkedin_not_connected",
    };
  }

  const accountId = integration.linkupAccountIdPlain;
  let connections = [];

  const needsConnectionChecks = prospects.some((p) => {
    const pending = (pendingLogsByProspect.get(p.id) ?? []).filter(
      (l) => l.channel === "linkedin" && !l.responseType
    );
    if (!pending.some((l) => l.ctaType === "connect_linkedin")) return false;

    const history = linkedInLogsByProspect?.get(p.id) ?? [];

    const hasPriorOutbound =
      history.some(
        (l) =>
          l.channel === "linkedin" &&
          (l.sentAt ||
            l.deliveredAt ||
            l.status === "sent" ||
            l.status === "delivered")
      ) || pending.some((l) => l.sentAt || l.deliveredAt || l.status === "sent" || l.status === "delivered");
    if (!hasPriorOutbound) return false;

    const alreadyConnected = history.some((l) => {
      if (l.responseType === "connected") return true;
      const state = l.deliveryMeta?.invitationState;
      return state === "ACCEPTED";
    });
    return !alreadyConnected;
  });

  if (needsConnectionChecks) {
    try {
      connections = await fetchAllConnections(accountId);
    } catch (err) {
      return {
        results: [],
        skipped: true,
        reason: err.message,
      };
    }
  }

  const results = [];
  const conversationCache = new Map();

  for (const prospect of prospects) {
    const pending = (pendingLogsByProspect.get(prospect.id) ?? []).filter(
      (l) => l.channel === "linkedin" && !l.responseType
    );
    if (!pending.length || !prospect.linkedinUrl) continue;

    const history = linkedInLogsByProspect?.get(prospect.id) ?? [];
    const hasPriorOutbound =
      history.some(
        (l) =>
          l.channel === "linkedin" &&
          (l.sentAt ||
            l.deliveredAt ||
            l.status === "sent" ||
            l.status === "delivered")
      ) || pending.some((l) => l.sentAt || l.deliveredAt || l.status === "sent" || l.status === "delivered");
    if (!hasPriorOutbound) continue;

    const alreadyConnected = history.some((l) => {
      if (l.responseType === "connected") return true;
      const state = l.deliveryMeta?.invitationState;
      return state === "ACCEPTED";
    });
    const alreadyReplied = history.some((l) => l.responseType === "reply");

    const pendingConnectionLogs = pending.filter(
      (l) => l.ctaType === "connect_linkedin"
    );
    const pendingDmLogs = pending.filter((l) => l.ctaType !== "connect_linkedin");

    const shouldCheckConnection = pendingConnectionLogs.length > 0 && !alreadyConnected;
    const shouldCheckConversation = pendingDmLogs.length > 0 && !alreadyReplied;

    let conversationResult = null;

    if (shouldCheckConversation) {
      try {
        if (!conversationCache.has(prospect.id)) {
          conversationCache.set(
            prospect.id,
            await fetchProspectConversation(accountId, prospect)
          );
        }
        conversationResult = conversationCache.get(prospect.id);
      } catch (err) {
        for (const log of pendingDmLogs) {
          results.push({
            prospectId: prospect.id,
            channel: "linkedin",
            activity: null,
            commLogId: log.id,
            error: err.message,
          });
        }
      }
    }

    const messages = conversationResult?.data?.messages ?? [];

    for (const log of pending) {
      try {
        if (log.ctaType === "connect_linkedin") {
          if (!shouldCheckConnection) continue;

          const conn = findConnectionForProspect(connections, prospect);
          if (conn) {
            const { updated, activity } = await applyLinkedInConnectedEngagement(
              log,
              {
                invitationState: "ACCEPTED",
                message: `Connected with ${conn.name ?? prospect.name}`,
              }
            );
            if (updated) {
              results.push({
                prospectId: prospect.id,
                channel: "linkedin",
                activity,
                commLogId: log.id,
              });
              continue;
            }
          }

          const check = await linkupCheckInvitation({
            accountId,
            profileUrl: prospect.linkedinUrl,
          });
          const state = check.data?.invitation_state;
          if (state === "ACCEPTED") {
            const { updated, activity } = await applyLinkedInConnectedEngagement(
              log,
              {
                invitationState: state,
                message: check.data?.message,
              }
            );
            if (updated) {
              results.push({
                prospectId: prospect.id,
                channel: "linkedin",
                activity,
                commLogId: log.id,
              });
            }
          }
          continue;
        }

        if (!shouldCheckConversation) continue;
        if (!conversationResult) continue;

        const baselineMs = outboundBaselineMs(log);
        let reply = findProspectReplyInMessages(
          messages,
          prospect,
          baselineMs
        );

        if (!reply && (conversationResult.data?.unread_count ?? 0) > 0) {
          const latest = messages[0];
          if (
            latest?.text &&
            isInboundTextMessage(latest, prospect) &&
            Number(latest.timestamp) > baselineMs
          ) {
            reply = {
              text: latest.text.trim(),
              timestamp: Number(latest.timestamp) || Date.now(),
            };
          }
        }

        if (reply) {
          const { updated, activity } = await applyLinkedInReplyEngagement(log, {
            responseContent: reply.text,
            repliedAt: new Date(reply.timestamp),
          });
          if (updated) {
            results.push({
              prospectId: prospect.id,
              channel: "linkedin",
              activity,
              commLogId: log.id,
            });
          }
        }
      } catch (err) {
        results.push({
          prospectId: prospect.id,
          channel: "linkedin",
          activity: null,
          commLogId: log.id,
          error: err.message,
        });
      }
    }
  }

  return { results, skipped: false };
}

export { PENDING_STATUSES };
