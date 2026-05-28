import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { requireSuperAdmin } from "@/lib/requireAuth";

export async function GET(_request, { params }) {
  const ctx = await getAuthContext();
  const err = requireSuperAdmin(ctx);
  if (err) return err;

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      linkedInIntegration: true,
      emailIntegration: true,
      whatsappIntegration: true,
      calendlyIntegration: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    linkedin: tenant.linkedInIntegration
      ? {
          status: tenant.linkedInIntegration.status,
          accountName: tenant.linkedInIntegration.accountName,
          email: tenant.linkedInIntegration.email,
          connectedAt: tenant.linkedInIntegration.connectedAt?.toISOString() || null,
        }
      : null,
    email: tenant.emailIntegration
      ? {
          status: tenant.emailIntegration.status,
          fromEmail: tenant.emailIntegration.fromEmail,
          fromName: tenant.emailIntegration.fromName,
          providerType: tenant.emailIntegration.providerType,
          connectedAt: tenant.emailIntegration.connectedAt?.toISOString() || null,
        }
      : null,
    whatsapp: tenant.whatsappIntegration
      ? {
          status: tenant.whatsappIntegration.status,
          mode: tenant.whatsappIntegration.mode,
          businessPhone: tenant.whatsappIntegration.businessPhone,
          businessName: tenant.whatsappIntegration.businessName,
          templatesCachedAt:
            tenant.whatsappIntegration.templatesCachedAt?.toISOString() || null,
          connectedAt: tenant.whatsappIntegration.connectedAt?.toISOString() || null,
        }
      : null,
    calendly: tenant.calendlyIntegration
      ? {
          status: tenant.calendlyIntegration.status,
          ownerEmail: tenant.calendlyIntegration.ownerEmail,
          connectionMode: tenant.calendlyIntegration.connectionMode,
          connectedAt: tenant.calendlyIntegration.connectedAt?.toISOString() || null,
        }
      : null,
  });
}
