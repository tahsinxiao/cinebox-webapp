import { NextResponse } from "next/server";
import { ensureSession } from "@/lib/moviebox/client";
import { HOST_POOL, UPSTREAM } from "@/lib/moviebox/generated/upstream-contract";
import { proxyUrl, usingProxy } from "@/lib/net";

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
      egressRegion: process.env.VERCEL_REGION ?? "local",
      proxy: usingProxy() ? new URL(proxyUrl()!).host : null,
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
        egressRegion: process.env.VERCEL_REGION ?? "local",
        proxy: usingProxy() ? new URL(proxyUrl()!).host : null,
        latencyMs: Date.now() - started,
        note: "Serving the bundled offline catalog until the provider is reachable.",
        hint: usingProxy()
          ? "A proxy is configured but the provider still refused. Check that its exit IP is residential/mobile and in a served region."
          : "The MovieBox edge rejects datacenter IPs (403 'Service not available in current region' / 440 ServiceNotAvailable). Set MOVIEBOX_PROXY_URL to a residential or mobile HTTP(S) proxy. See /api/debug/provider.",
      },
      { status: 503 },
    );
  }
}
