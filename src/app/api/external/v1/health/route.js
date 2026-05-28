import { ok } from "@/lib/externalApi";

export async function GET(request) {
  return ok(request, {
    status: "ok",
    service: "clarwiz-external-api",
    version: "v1",
    timestamp: new Date().toISOString(),
  });
}
