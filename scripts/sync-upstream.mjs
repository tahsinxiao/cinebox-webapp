#!/usr/bin/env node
/**
 * well-cinebox :: upstream sync
 * ---------------------------------------------------------------------------
 * Keeps this webapp permanently wired to the upstream project
 *   https://github.com/mesamirh/MovieBox-Tui
 *
 * The upstream project is a Rust TUI. The pieces this webapp actually depends
 * on are the *provider contract*: API host pool, request-signing material,
 * endpoint paths, client fingerprint and stream-resolution rules.
 *
 * This script:
 *   1. resolves the newest upstream commit on `main`
 *   2. downloads that exact tree from codeload
 *   3. vendors the provider sources into `upstream/moviebox-tui/`
 *   4. parses the Rust sources and regenerates
 *      `lib/moviebox/generated/upstream-contract.ts`
 *
 * Run locally:  npm run sync:upstream
 * Run in CI:    .github/workflows/upstream-sync.yml (every 3h + on demand)
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM_OWNER = process.env.UPSTREAM_OWNER || "mesamirh";
const UPSTREAM_REPO = process.env.UPSTREAM_REPO || "MovieBox-Tui";
const UPSTREAM_REF = process.env.UPSTREAM_REF || "main";
const SLUG = `${UPSTREAM_OWNER}/${UPSTREAM_REPO}`;

const VENDOR_DIR = path.join(ROOT, "upstream", "moviebox-tui");
const GENERATED_FILE = path.join(ROOT, "lib", "moviebox", "generated", "upstream-contract.ts");

/** Files vendored from upstream (relative to the upstream repo root). */
const VENDORED = [
  "src/providers/moviebox/client.rs",
  "src/providers/moviebox/crypto.rs",
  "src/providers/moviebox/mod.rs",
  "src/providers/moviebox/adapt.rs",
  "src/providers/moviebox/title.rs",
  "src/providers/moviebox/session.rs",
  "src/providers/models.rs",
  "Cargo.toml",
  "LICENSE-MIT",
];

const log = (...a) => console.log("[sync-upstream]", ...a);

function ghHeaders() {
  const h = { "user-agent": "well-cinebox-upstream-sync", accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function resolveCommit() {
  const url = `https://api.github.com/repos/${SLUG}/commits/${UPSTREAM_REF}`;
  const args = ["-fsSL"];
  for (const [k, v] of Object.entries(ghHeaders())) args.push("-H", `${k}: ${v}`);
  args.push(url);
  const json = JSON.parse(execFileSync("curl", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
  return {
    sha: json.sha,
    shortSha: String(json.sha).slice(0, 7),
    message: (json.commit?.message || "").split("\n")[0],
    author: json.commit?.author?.name || "unknown",
    date: json.commit?.author?.date || new Date().toISOString(),
    url: json.html_url,
  };
}

function downloadTree(sha) {
  const work = mkdtempSync(path.join(tmpdir(), "mbtui-"));
  const tarPath = path.join(work, "src.tar.gz");
  execFileSync("curl", ["-fsSL", "-o", tarPath, `https://codeload.github.com/${SLUG}/tar.gz/${sha}`], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  execFileSync("tar", ["-xzf", tarPath, "-C", work], { stdio: ["ignore", "ignore", "inherit"] });
  const inner = execFileSync("ls", [work], { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && s !== "src.tar.gz")[0];
  return { work, tree: path.join(work, inner) };
}

/* ------------------------------------------------------------------ parsing */

function need(value, label) {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0) || value === "") {
    throw new Error(`upstream contract drift: could not extract "${label}" from upstream sources`);
  }
  return value;
}

function parseStrArray(src, constName) {
  const re = new RegExp(`${constName}\\s*(?::[^=]*)?=\\s*&?\\[([\\s\\S]*?)\\];`);
  const m = src.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function parseNumArray(src, constName) {
  const re = new RegExp(`${constName}\\s*(?::[^=]*)?=\\s*&?\\[([\\s\\S]*?)\\];`);
  const m = src.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/(\d+)/g)].map((x) => Number(x[1]));
}

/** `b"\xef\xa8..."` → array of byte values. */
function parseSecretBytes(src) {
  const m = src.match(/DEFAULT_SECRET_BYTES\s*:\s*&\[u8\]\s*=\s*b"([\s\S]*?)";/);
  if (!m) return [];
  return [...m[1].matchAll(/\\x([0-9a-fA-F]{2})/g)].map((x) => parseInt(x[1], 16));
}

/** Tuple lists such as `("9", "PQ3A.190605.03081104"),` inside a named slice. */
function parseTupleArray(src, varName) {
  const re = new RegExp(`${varName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const m = src.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/\(\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)/g)].map((x) => [x[1], x[2]]);
}

function parseConstStr(src, constName) {
  const m = src.match(new RegExp(`${constName}\\s*:\\s*&str\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : "";
}

function parseConstNum(src, constName) {
  const m = src.match(new RegExp(`${constName}\\s*:\\s*usize\\s*=\\s*([0-9_]+)`));
  return m ? Number(m[1].replace(/_/g, "")) : 0;
}

/** Collect every `/wefeed-mobile-bff/...` path template used upstream. */
function parseEndpoints(src) {
  const found = new Set();
  for (const m of src.matchAll(/"(\/wefeed-mobile-bff\/[^"]*)"/g)) found.add(m[1]);
  return [...found].sort();
}

function parseDeprecationMarkers(src) {
  const m = src.match(/fn is_deprecation_notice_url[\s\S]*?\n\}/);
  if (!m) return [];
  return [...m[0].matchAll(/contains\("([^"]+)"\)/g)].map((x) => x[1]);
}

function buildContract(tree, commit) {
  const read = (rel) => readFileSync(path.join(tree, rel), "utf8");
  const client = read("src/providers/moviebox/client.rs");
  const crypto = read("src/providers/moviebox/crypto.rs");
  const mod = read("src/providers/moviebox/mod.rs");
  const adapt = read("src/providers/moviebox/adapt.rs");
  const cargo = read("Cargo.toml");

  const clientInfoBlock = crypto.match(/let client_info = format!\(\s*r#"([\s\S]*?)"#/);
  const versionName = clientInfoBlock ? (clientInfoBlock[1].match(/"version_name":"([^"]+)"/) || [])[1] : undefined;
  const packageName = clientInfoBlock ? (clientInfoBlock[1].match(/"package_name":"([^"]+)"/) || [])[1] : undefined;
  const spCode = clientInfoBlock ? (clientInfoBlock[1].match(/"sp_code":"([^"]+)"/) || [])[1] : undefined;
  const uaBlock = crypto.match(/let user_agent = format!\(\s*"([^"]+)"/);

  const contract = {
    upstream: {
      repo: SLUG,
      url: `https://github.com/${SLUG}`,
      ref: UPSTREAM_REF,
      commit: commit.sha,
      shortCommit: commit.shortSha,
      commitMessage: commit.message,
      commitDate: commit.date,
      commitUrl: commit.url,
      cargoVersion: need((cargo.match(/^version\s*=\s*"([^"]+)"/m) || [])[1], "Cargo.toml version"),
      syncedAt: new Date().toISOString(),
    },
    hostPool: need(parseStrArray(client, "HOST_POOL"), "HOST_POOL"),
    retryStatusCodes: need(parseNumArray(client, "RETRY_STATUS_CODES"), "RETRY_STATUS_CODES"),
    signing: {
      secretBytes: need(parseSecretBytes(crypto), "DEFAULT_SECRET_BYTES"),
      bodyMaxBytes: parseConstNum(crypto, "SIGNATURE_BODY_MAX_BYTES") || 102400,
      signatureVersion: "2",
    },
    streamReferer: need(parseConstStr(mod, "STREAM_REFERER"), "STREAM_REFERER"),
    endpoints: need(parseEndpoints(`${mod}\n${client}`), "wefeed endpoints"),
    fingerprint: {
      packageName: need(packageName, "client_info.package_name"),
      versionName: need(versionName, "client_info.version_name"),
      spCode: spCode || "40401",
      userAgentTemplate: need(uaBlock && uaBlock[1], "user_agent template"),
      versionCodes: need(parseNumArray(crypto, "let version_codes"), "version_codes"),
      androidVersions: need(parseTupleArray(crypto, "let android_versions"), "android_versions"),
      devices: need(parseTupleArray(crypto, "let redmi_devices"), "redmi_devices"),
      networkTypes: need(parseStrArray(crypto, "let network_types"), "network_types"),
      timezones: need(parseStrArray(crypto, "let timezones"), "timezones"),
      ipPrefixes: need(parseStrArray(crypto, "let prefixes"), "spoofed ip prefixes"),
    },
    deprecationMarkers: parseDeprecationMarkers(adapt),
  };
  return contract;
}

function emitTs(contract) {
  const j = (v) => JSON.stringify(v, null, 2);
  return `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Generated by \`npm run sync:upstream\` from ${contract.upstream.url}
 * Upstream commit: ${contract.upstream.shortCommit} — ${contract.upstream.commitMessage}
 * Upstream version: v${contract.upstream.cargoVersion}
 * Synced at: ${contract.upstream.syncedAt}
 *
 * Every upstream patch that touches the MovieBox provider (hosts, signing
 * secret, endpoints, device fingerprint, stream rules) is pulled in here
 * automatically by .github/workflows/upstream-sync.yml, which then triggers a
 * fresh Vercel deployment of well-cinebox.
 */

export const UPSTREAM = ${j(contract.upstream)} as const;

/** Rotating API host pool, in upstream priority order. */
export const HOST_POOL: readonly string[] = ${j(contract.hostPool)};

/** HTTP statuses that trigger a host rotation + retry. */
export const RETRY_STATUS_CODES: readonly number[] = ${j(contract.retryStatusCodes)};

/** HMAC-MD5 key material used for the \`x-tr-signature\` header. */
export const SIGNING = {
  secretBytes: Uint8Array.from(${JSON.stringify(contract.signing.secretBytes)}),
  bodyMaxBytes: ${contract.signing.bodyMaxBytes},
  signatureVersion: "${contract.signing.signatureVersion}",
} as const;

/** Referer required by the CDN when fetching a resolved stream. */
export const STREAM_REFERER = ${JSON.stringify(contract.streamReferer)};

/** Every BFF endpoint template the upstream client talks to. */
export const ENDPOINTS: readonly string[] = ${j(contract.endpoints)};

/** Android client fingerprint pool (user-agent + x-client-info). */
export const FINGERPRINT = ${j(contract.fingerprint)} as const;

/** URL fragments that identify "this title is unavailable" placeholder videos. */
export const DEPRECATION_MARKERS: readonly string[] = ${j(contract.deprecationMarkers)};
`;
}

/* --------------------------------------------------------------------- main */

async function main() {
  log(`resolving ${SLUG}@${UPSTREAM_REF} …`);
  const commit = await resolveCommit();
  log(`upstream HEAD ${commit.shortSha} — ${commit.message}`);

  const { work, tree } = downloadTree(commit.sha);
  try {
    rmSync(VENDOR_DIR, { recursive: true, force: true });
    for (const rel of VENDORED) {
      const from = path.join(tree, rel);
      if (!existsSync(from)) {
        log(`! upstream file missing, skipped: ${rel}`);
        continue;
      }
      const to = path.join(VENDOR_DIR, rel);
      mkdirSync(path.dirname(to), { recursive: true });
      cpSync(from, to);
    }
    writeFileSync(
      path.join(VENDOR_DIR, "UPSTREAM.json"),
      `${JSON.stringify({ repo: SLUG, ...commit, vendored: VENDORED, syncedAt: new Date().toISOString() }, null, 2)}\n`,
    );
    log(`vendored ${VENDORED.length} upstream files → upstream/moviebox-tui/`);

    const contract = buildContract(tree, commit);
    mkdirSync(path.dirname(GENERATED_FILE), { recursive: true });
    writeFileSync(GENERATED_FILE, emitTs(contract));
    log(`wrote ${path.relative(ROOT, GENERATED_FILE)}`);
    log(`hosts=${contract.hostPool.length} endpoints=${contract.endpoints.length} secret=${contract.signing.secretBytes.length}B`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  log("done.");
}

main().catch((err) => {
  console.error("[sync-upstream] FAILED:", err.message);
  process.exit(1);
});
