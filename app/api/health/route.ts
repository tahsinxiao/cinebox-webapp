import { NextResponse } from "next/server";
import { ensureSession } from "@/lib/moviebox/client";
import { HOST_POOL, UPSTREAM } from "@/lib/moviebox/generated/upstream-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const token = await ensureSession();
    return NextResponse.json({
      ok: true,
      provider: "moviebox",
      session: token ? "authenticated" : "anonymous",
      hosts: HOST_POOL.length,
      latencyMs: Date.now() - started,
      upstream: { repo: UPSTREAM.repo, commit: UPSTREAM.shortCommit, version: UPSTREAM.cargoVersion },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider: "moviebox",
        error: err instanceof Error ? err.message : String(err),
        hosts: HOST_POOL.length,
        latencyMs: Date.now() - started,
        note: "Serving the bundled offline catalog until the provider is reachable.",
      },
      { status: 503 },
    );
  }
}
