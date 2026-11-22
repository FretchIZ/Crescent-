import { healthResponse } from "@/lib/health";

/**
 * Root-level alias for /api/health. Some load balancers and uptime monitors
 * probe /health by convention, so both paths expose the same report.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return healthResponse();
}
