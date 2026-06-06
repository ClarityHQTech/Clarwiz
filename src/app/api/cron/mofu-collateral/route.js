import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runPathBPipeline } from "@/lib/mofu/collateral/pathB";

// Queued Path B worker. Processes DRAFT path-B Documents (sales collateral jobs).
export async function POST(request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobs = await prisma.document.findMany({
    where: { path: "B", status: "DRAFT" },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  const summary = { processed: 0, failed: 0, results: [] };
  for (const job of jobs) {
    try {
      const out = await runPathBPipeline(job.id);
      if (out.ok) summary.processed += 1;
      else summary.failed += 1;
      summary.results.push({ documentId: job.id, ok: out.ok, reason: out.reason });
    } catch (err) {
      summary.failed += 1;
      summary.results.push({ documentId: job.id, ok: false, reason: err.message });
    }
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString(), ...summary });
}
