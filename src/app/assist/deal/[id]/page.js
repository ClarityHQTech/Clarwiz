import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authContext";
import { getDealView } from "@/lib/assist/insightsReader";
import { toDealViewModel } from "@/lib/assist/dealViewModel";
import DealWorkroomClient from "@/components/assist/deal/DealWorkroomClient";

export default async function DealWorkroomPage({ params }) {
  const { id } = await params;

  const ctx = await getAuthContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) notFound();

  const view = await getDealView(prisma, tenantId, id);
  if (!view) notFound();

  const vm = toDealViewModel(view);
  return <DealWorkroomClient id={id} vm={vm} />;
}
