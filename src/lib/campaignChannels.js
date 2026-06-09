import { CAMPAIGN_CHANNELS, CHANNEL_LABELS } from "@/lib/campaignConstants";

/** Default: all supported outreach channels enabled. */
export const DEFAULT_ENABLED_CHANNELS = [...CAMPAIGN_CHANNELS];

export function normalizeEnabledChannels(channels) {
  if (!Array.isArray(channels)) {
    return [...DEFAULT_ENABLED_CHANNELS];
  }
  const picked = CAMPAIGN_CHANNELS.filter((ch) => channels.includes(ch));
  return picked.length > 0 ? picked : [...DEFAULT_ENABLED_CHANNELS];
}

export function resolveCampaignEnabledChannels(campaign) {
  return normalizeEnabledChannels(campaign?.enabledChannels);
}

export function isCampaignChannelEnabled(campaign, channel) {
  return resolveCampaignEnabledChannels(campaign).includes(channel);
}

export function filterTemplatesByEnabledChannels(templates, campaign) {
  const enabled = resolveCampaignEnabledChannels(campaign);
  return (templates ?? []).filter((t) => enabled.includes(t.channel));
}

export function enabledChannelLabels(campaign) {
  return resolveCampaignEnabledChannels(campaign).map(
    (ch) => CHANNEL_LABELS[ch] ?? ch
  );
}
