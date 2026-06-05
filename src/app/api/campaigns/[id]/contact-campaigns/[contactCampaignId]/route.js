import { resolveApiAuth } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  patchContactCampaign,
  removeContactCampaign,
} from "@/lib/api/campaignContacts";

export async function PATCH(request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  return patchContactCampaign(
    request,
    params.id,
    ctx.tenantId,
    params.contactCampaignId
  );
}

export async function DELETE(_request, { params }) {
  const auth = await resolveApiAuth({ permission: PERMISSIONS.CAMPAIGN_MANAGE });
  if (auth.error) return auth.error;
  const { ctx } = auth;

  return removeContactCampaign(
    params.id,
    ctx.tenantId,
    params.contactCampaignId
  );
}
