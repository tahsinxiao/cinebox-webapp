/**
 * Signed stream tokens.
 *
 * The MovieBox CDN only serves media when the request carries the upstream
 * Referer / Cookie / User-Agent headers, which a browser cannot set on a
 * cross-origin request. So playback goes through `/api/stream`, and the
 * target URL + headers are handed to the client as an opaque, HMAC-signed,
 * short-lived token. Signing keeps the route from becoming an open proxy.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SEC = Number(process.env.STREAM_TOKEN_TTL_SEC ?? 6 * 60 * 60);

function secret(): string {
  return (
    process.env.STREAM_SIGNING_SECRET ??
    process.env.VERCEL_URL ??
    "well-cinebox-dev-secret-change-me"
  );
}

export interface StreamTarget {
  url: string;
  headers?: Record<string, string>;
  /** `video` | `text` — restricts what the proxy will return. */
  kind?: "video" | "text";
}

interface Payload extends StreamTarget {
  exp: number;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function signStreamTarget(target: StreamTarget): string {
  const payload: Payload = { ...target, exp: Math.floor(Date.now() / 1000) + TTL_SEC };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyStreamToken(token: string): StreamTarget | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = b64url(createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (!payload.url || typeof payload.url !== "string") return null;
    if (!/^https?:\/\//i.test(payload.url)) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { url: payload.url, headers: payload.headers, kind: payload.kind ?? "video" };
  } catch {
    return null;
  }
}

export const proxyUrlFor = (target: StreamTarget): string =>
  `/api/stream?t=${encodeURIComponent(signStreamTarget(target))}`;

export const subtitleUrlFor = (url: string): string =>
  `/api/subtitle?t=${encodeURIComponent(signStreamTarget({ url, kind: "text" }))}`;
