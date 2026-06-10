import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  patchCampaignContact,
  removeCampaignContact,
} from "@/lib/api/campaignContacts";

/** @deprecated Use /api/campaigns/[id]/contact-campaigns/[campaignContactId] */
export async function PATCH(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  return patchCampaignContact(
    request,
    params.id,
    ctx.tenantId,
    params.prospectId
  );
}

/** @deprecated Use DELETE /api/campaigns/[id]/contact-campaigns/[campaignContactId] */
export async function DELETE(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  return removeCampaignContact(params.id, ctx.tenantId, params.prospectId);
}
