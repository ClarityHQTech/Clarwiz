import {
  linkupCheckInvitation,
  linkupGetConversation,
  linkupListConnections,
  linkupListInbox,
} from "@/lib/linkupApi";
import { getLinkedInIntegrationWithAccountId } from "@/lib/linkedinIntegration";
import { linkedInUrlsMatch } from "@/lib/linkedinProfileUrl";
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

async function fetchInboxConversations(accountId) {
  const conversations = [];
  let nextCursor;

  do {
    const result = await linkupListInbox({
      accountId,
      totalResults: 50,
      category: "INBOX",
      nextCursor,
    });
    const batch = result.data?.conversations ?? [];
    conversations.push(...batch);
    nextCursor = result.data?.next_cursor ?? null;
    if (batch.length === 0) break;
    if (conversations.length >= 200) break;
  } while (nextCursor);

  return conversations;
}

function findConnectionForProspect(connections, prospect) {
  if (!prospect.linkedinUrl) return null;
  return (
    connections.find((c) =>
      linkedInUrlsMatch(c.profile_url, prospect.linkedinUrl)
    ) ?? null
  );
}

function findInboxForProspect(conversations, prospect) {
  if (!prospect.linkedinUrl) return null;
  return (
    conversations.find((c) =>
      linkedInUrlsMatch(c.participant?.profile_url, prospect.linkedinUrl)
    ) ?? null
  );
}

function prospectRepliedInInbox(inboxConv, logSentAt) {
  const last = inboxConv?.last_message;
  if (!last?.text || last.sender?.is_me) return null;
  const msgTime = last.time ? Number(last.time) : null;
  const sentMs = logSentAt ? new Date(logSentAt).getTime() : 0;
  if (msgTime && msgTime <= sentMs) return null;
  return last.text;
}

/**
 * Track LinkedIn connection accepts and message replies for pending comm logs.
 * Uses batch list_connections + list_inbox; check_invitation as fallback.
 */
export async function checkLinkedInEngagementForCampaign({
  userId,
  campaignId,
  prospects,
  pendingLogsByProspect,
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
  const hasLinkedInPending = prospects.some((p) => {
    const logs = pendingLogsByProspect.get(p.id) ?? [];
    return logs.some((l) => l.channel === "linkedin");
  });

  if (!hasLinkedInPending) {
    return { results: [], skipped: false };
  }

  let connections = [];
  let conversations = [];

  try {
    connections = await fetchAllConnections(accountId);
    conversations = await fetchInboxConversations(accountId);
  } catch (err) {
    return {
      results: [],
      skipped: true,
      reason: err.message,
    };
  }

  const results = [];

  for (const prospect of prospects) {
    const pending = (pendingLogsByProspect.get(prospect.id) ?? []).filter(
      (l) => l.channel === "linkedin" && !l.responseType
    );
    if (!pending.length || !prospect.linkedinUrl) continue;

    for (const log of pending) {
      try {
        if (log.ctaType === "connect_linkedin") {
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

        const inboxConv = findInboxForProspect(conversations, prospect);
        let replyText = prospectRepliedInInbox(inboxConv, log.sentAt);

        if (!replyText && inboxConv?.unread > 0) {
          const conv = await linkupGetConversation({
            accountId,
            profileUrl: prospect.linkedinUrl,
            count: 5,
          });
          const messages = conv.data?.messages ?? [];
          const sentMs = log.sentAt ? new Date(log.sentAt).getTime() : 0;
          const inbound = messages.find((m) => {
            const ts = m.timestamp ? Number(m.timestamp) : 0;
            const fromProspect =
              m.sender_info?.profile_url &&
              linkedInUrlsMatch(m.sender_info.profile_url, prospect.linkedinUrl);
            return fromProspect && ts > sentMs && m.text;
          });
          replyText = inbound?.text ?? null;
        }

        if (replyText) {
          const { updated, activity } = await applyLinkedInReplyEngagement(log, {
            responseContent: replyText,
            repliedAt: inboxConv?.last_message?.time
              ? new Date(Number(inboxConv.last_message.time))
              : new Date(),
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
