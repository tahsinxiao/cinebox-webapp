import { outboundFetch } from "@/lib/net";
import { verifyStreamToken } from "@/lib/stream-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
]);

/**
 * Range-aware media proxy.
 *
 * The upstream CDN requires Referer/Cookie/User-Agent headers that a browser
 * will not send cross-origin, so every byte of playback is relayed here.
 * Targets are HMAC-signed by /api/play — this is not an open proxy.
 */
async function relay(request: Request, method: "GET" | "HEAD") {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t");
  if (!token) return new Response("missing token", { status: 400 });

  const target = verifyStreamToken(token);
  if (!target) return new Response("invalid or expired token", { status: 403 });
  if (target.kind === "text") return new Response("wrong endpoint for this token", { status: 400 });

  const headers = new Headers();
  for (const [k, v] of Object.entries(target.headers ?? {})) headers.set(k, v);
  const range = request.headers.get("range");
  if (range) headers.set("range", range);
  headers.set("accept", "*/*");
  if (!headers.has("user-agent")) headers.set("user-agent", "Mozilla/5.0");

  let upstream: Response;
  try {
    upstream = await outboundFetch(target.url, { method, headers, redirect: "follow", cache: "no-store" });
  } catch (err) {
    return new Response(`upstream fetch failed: ${err instanceof Error ? err.message : "unknown"}`, {
      status: 502,
    });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === "set-cookie" || lower === "content-encoding") return;
    out.set(key, value);
  });
  out.set("accept-ranges", "bytes");
  out.set("cache-control", "private, max-age=0, no-store");
  out.set("access-control-allow-origin", "*");
  if (!out.has("content-type")) out.set("content-type", "video/mp4");

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export const GET = (request: Request) => relay(request, "GET");
export const HEAD = (request: Request) => relay(request, "HEAD");

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,HEAD,OPTIONS",
      "access-control-allow-headers": "range",
    },
  });
}
