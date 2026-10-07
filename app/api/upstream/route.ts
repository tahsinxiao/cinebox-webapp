import { NextResponse } from "next/server";
import {
  DEPRECATION_MARKERS,
  ENDPOINTS,
  FINGERPRINT,
  HOST_POOL,
  RETRY_STATUS_CODES,
  UPSTREAM,
} from "@/lib/moviebox/generated/upstream-contract";

export const runtime = "nodejs";
export const revalidate = 3600;

/** Public view of exactly which upstream revision this deployment is running. */
export async function GET() {
  return NextResponse.json({
    app: "well-cinebox",
    upstream: UPSTREAM,
    contract: {
      hosts: HOST_POOL,
      retryStatusCodes: RETRY_STATUS_CODES,
      endpoints: ENDPOINTS,
      clientVersion: FINGERPRINT.versionName,
      package: FINGERPRINT.packageName,
      deprecationMarkers: DEPRECATION_MARKERS.length,
    },
    deployment: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      env: process.env.VERCEL_ENV ?? "local",
    },
  });
}
