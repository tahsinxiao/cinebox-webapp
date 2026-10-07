/**
 * Outbound HTTP for provider + media traffic.
 *
 * The MovieBox BFF refuses datacenter egress. Verified from production:
 *
 *   iad1 (AWS us-east-1), unsigned → 403 "Service not available in current region"
 *   bom1 (AWS ap-south-1), any headers → 440 {"message":"ServiceNotAvailable"}
 *
 * Signature, user-agent and `x-forwarded-for` spoofing make no difference — the
 * edge keys off the real TCP source IP, and every Vercel region is a cloud ASN.
 * The only way to reach it from a serverless host is to egress through a
 * network the provider serves (residential / mobile / a VPS on a clean ASN).
 *
 * Set `MOVIEBOX_PROXY_URL` to an HTTP(S) proxy and every provider and media
 * request is routed through it. Unset, we use plain global fetch, and the app
 * degrades to the clearly-labelled offline catalog.
 */
import "server-only";
import { ProxyAgent } from "undici";

type Dispatcher = ConstructorParameters<typeof ProxyAgent> extends never ? never : ProxyAgent;

let cached: Dispatcher | null | undefined;

export function proxyUrl(): string | null {
  const url = process.env.MOVIEBOX_PROXY_URL?.trim();
  return url ? url : null;
}

function dispatcher(): Dispatcher | null {
  if (cached !== undefined) return cached;
  const url = proxyUrl();
  if (!url) {
    cached = null;
    return null;
  }
  try {
    cached = new ProxyAgent(url);
  } catch {
    cached = null;
  }
  return cached;
}

export const usingProxy = (): boolean => dispatcher() !== null;

/**
 * `fetch` that honours MOVIEBOX_PROXY_URL. Returns a standard `Response`, so
 * `.body` can still be piped straight through by the media proxy route.
 */
export function outboundFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const agent = dispatcher();
  if (!agent) return fetch(url, init);
  return fetch(url, { ...init, dispatcher: agent } as RequestInit);
}
