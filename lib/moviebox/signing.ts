/**
 * Request signing — 1:1 TypeScript port of
 * `src/providers/moviebox/crypto.rs` from mesamirh/MovieBox-Tui.
 *
 * All key material / fingerprint pools come from the auto-generated upstream
 * contract, so an upstream patch propagates here without code changes.
 */
import { createHash, createHmac } from "node:crypto";
import { FINGERPRINT, SIGNING } from "./generated/upstream-contract";

export const md5Hex = (input: string | Buffer): string =>
  createHash("md5").update(input).digest("hex");

/** `x-client-token: <ts>,<md5(reverse(ts))>` */
export function generateClientToken(ts: number): string {
  const tsStr = String(ts);
  const reversed = tsStr.split("").reverse().join("");
  return `${tsStr},${md5Hex(reversed)}`;
}

/** Query string with keys sorted (BTreeMap order upstream), values decoded. */
export function sortedQueryString(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  const buckets = new Map<string, string[]>();
  parsed.searchParams.forEach((value, key) => {
    const list = buckets.get(key);
    if (list) list.push(value);
    else buckets.set(key, [value]);
  });
  if (buckets.size === 0) return "";
  const parts: string[] = [];
  for (const key of [...buckets.keys()].sort()) {
    for (const value of buckets.get(key)!) parts.push(`${key}=${value}`);
  }
  return parts.join("&");
}

export function buildCanonicalString(
  method: string,
  accept: string,
  contentType: string,
  url: string,
  body: string | null,
  timestampMs: number,
): string {
  let canonicalUrl = url;
  try {
    const parsed = new URL(url);
    const query = sortedQueryString(url);
    canonicalUrl = query ? `${parsed.pathname}?${query}` : parsed.pathname;
  } catch {
    /* keep raw url */
  }

  let bodyHash = "";
  let bodyLength = "";
  if (body !== null && body !== undefined) {
    const bytes = Buffer.from(body, "utf8");
    bodyLength = String(bytes.length);
    bodyHash = md5Hex(bytes.subarray(0, Math.min(bytes.length, SIGNING.bodyMaxBytes)));
  }

  return [
    method.toUpperCase(),
    accept,
    contentType,
    bodyLength,
    String(timestampMs),
    bodyHash,
    canonicalUrl,
  ].join("\n");
}

/** `x-tr-signature: <ts>|2|<base64(hmac-md5(secret, canonical))>` */
export function generateSignature(
  method: string,
  accept: string,
  contentType: string,
  url: string,
  body: string | null,
  timestampMs: number,
): string {
  const canonical = buildCanonicalString(method, accept, contentType, url, body, timestampMs);
  const mac = createHmac("md5", Buffer.from(SIGNING.secretBytes))
    .update(canonical, "utf8")
    .digest("base64");
  return `${timestampMs}|${SIGNING.signatureVersion}|${mac}`;
}

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomHex = (len: number) =>
  Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const randomUuid = () =>
  `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`;

export interface ClientIdentity {
  userAgent: string;
  clientInfo: string;
  spoofedIp: string;
}

/** Android app fingerprint, mirroring `generate_client_info_and_ua()`. */
export function generateClientIdentity(): ClientIdentity {
  const [osVersion, build] = pick(FINGERPRINT.androidVersions) as readonly [string, string];
  const [model, brand] = pick(FINGERPRINT.devices) as readonly [string, string];
  const versionCode = pick(FINGERPRINT.versionCodes);
  const net = pick(FINGERPRINT.networkTypes);
  const timezone = pick(FINGERPRINT.timezones);

  const userAgent = `${FINGERPRINT.packageName}/${versionCode} (Linux; U; Android ${osVersion}; en_US; ${model}; Build/${build}; Cronet/135.0.7012.3)`;

  const clientInfo = JSON.stringify({
    package_name: FINGERPRINT.packageName,
    version_name: FINGERPRINT.versionName,
    version_code: versionCode,
    os: "android",
    os_version: osVersion,
    install_ch: "ps",
    device_id: randomHex(32),
    install_store: "ps",
    gaid: randomUuid(),
    brand,
    model,
    system_language: "en",
    net,
    region: "US",
    timezone,
    sp_code: FINGERPRINT.spCode,
    "X-Play-Mode": "2",
  });

  const prefix = pick(FINGERPRINT.ipPrefixes);
  const spoofedIp = `${prefix}.${1 + Math.floor(Math.random() * 253)}.${1 + Math.floor(Math.random() * 253)}`;

  return { userAgent, clientInfo, spoofedIp };
}

export function buildSignedHeaders(
  method: string,
  url: string,
  body: string | null,
  authToken: string | null,
  identity: ClientIdentity,
): Record<string, string> {
  const ts = Date.now();
  const accept = "application/json";
  const contentType = "application/json";

  const headers: Record<string, string> = {
    "user-agent": identity.userAgent,
    accept,
    "content-type": contentType,
    "x-client-token": generateClientToken(ts),
    "x-tr-signature": generateSignature(method, accept, contentType, url, body, ts),
    "x-client-info": identity.clientInfo,
    "x-client-status": "0",
    "x-forwarded-for": identity.spoofedIp,
  };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  return headers;
}
