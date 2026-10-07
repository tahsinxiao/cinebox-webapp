import { NextResponse } from "next/server";
import { HOST_POOL } from "@/lib/moviebox/generated/upstream-contract";
import { buildSignedHeaders, generateClientIdentity } from "@/lib/moviebox/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * TEMPORARY provider diagnostics.
 *
 * The sandbox this app was built in cannot reach the MovieBox hosts, so this
 * endpoint runs the handshake from the deployment itself and reports exactly
 * what each host answers. Remove once the provider path is confirmed healthy.
 */

const PATH = "/wefeed-mobile-bff/user-api/visitor-login";
const BODY = "{}";
const TIMEOUT = 6000;

interface Probe {
  label: string;
  host: string;
  status?: number;
  ok?: boolean;
  ms: number;
  body?: string;
  server?: string | null;
  via?: string | null;
  xCache?: string | null;
  error?: string;
}

async function probe(label: string, host: string, mutate?: (h: Record<string, string>) => void): Promise<Probe> {
  const started = Date.now();
  const url = `${host}${PATH}`;
  const headers = buildSignedHeaders("POST", url, BODY, null, generateClientIdentity());
  mutate?.(headers);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: BODY,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    return {
      label,
      host,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - started,
      body: text.slice(0, 400),
      server: res.headers.get("server"),
      via: res.headers.get("via"),
      xCache: res.headers.get("x-cache") ?? res.headers.get("cf-ray"),
    };
  } catch (err) {
    return { label, host, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const perHost = HOST_POOL.map((host) => probe("signed", host));

  const variants = [
    probe("no-xff", HOST_POOL[0], (h) => {
      delete h["x-forwarded-for"];
    }),
    probe("browser-ua", HOST_POOL[0], (h) => {
      h["user-agent"] =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
    }),
    probe("no-signature", HOST_POOL[0], (h) => {
      delete h["x-tr-signature"];
    }),
    probe("bare", HOST_POOL[0], (h) => {
      for (const k of Object.keys(h)) if (k !== "content-type" && k !== "accept") delete h[k];
    }),
  ];

  const results = await Promise.all([...perHost, ...variants]);
  const reachable = results.filter((r) => r.ok);

  return NextResponse.json(
    {
      note: "temporary diagnostics — remove after the provider path is confirmed",
      egressRegion: process.env.VERCEL_REGION ?? "unknown",
      summary: {
        hostsProbed: HOST_POOL.length,
        anyOk: reachable.length > 0,
        okHosts: reachable.map((r) => r.host),
        statuses: [...new Set(results.map((r) => r.status ?? r.error))],
      },
      results,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
