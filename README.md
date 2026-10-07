<div align="center">

# well-cinebox

**Free Movie &amp; Series Streaming Webapp** — an HBO Max-style streaming front-end for the
[MovieBox-Tui](https://github.com/mesamirh/MovieBox-Tui) provider network.

Next.js 15 · React 19 · TypeScript · Tailwind · Vercel-ready · auto-synced with upstream

</div>

---

## What this is

[`mesamirh/MovieBox-Tui`](https://github.com/mesamirh/MovieBox-Tui) is a Rust **terminal** client for the
MovieBox network. **well-cinebox** takes the part that matters — the provider contract (API host pool,
request signing, endpoints, device fingerprint, stream-resolution rules) — ports it to TypeScript, and
wraps it in a cinematic web UI that deploys to Vercel in one click.

The link to upstream is **not a one-off copy**. A scheduled GitHub Action re-reads the upstream Rust
sources every 3 hours, regenerates the typed contract, proves the app still builds, and pushes — which
triggers a fresh Vercel deployment. Upstream patches land in production without anyone touching code.

```
mesamirh/MovieBox-Tui (Rust TUI)
          │
          │  upstream-sync.yml  GitHub Action      (every 3h + on demand)
          │  scripts/sync-upstream.mjs             (parse Rust → emit TS)
          ▼
upstream/moviebox-tui/**                  vendored provider sources (readable diff)
lib/moviebox/generated/upstream-contract.ts   hosts · secret · endpoints · fingerprint
          │
          ▼
lib/moviebox/{signing,client,adapt,api}.ts    TypeScript port of the provider
          │
          ▼
Next.js App Router UI + /api proxy  ──►  Vercel  ──►  well-cinebox
```

---

## Features

**Experience**
- HBO Max-inspired dark/purple design system: rotating hero, horizontal rails with edge fades and
  arrow controls, Top-10 ranked rail, hover-reveal poster cards, glassmorphic sticky header.
- Full title pages: poster + backdrop, synopsis, genres, cast, rating, season/episode picker.
- Custom video player: quality switching, subtitles (SRT→VTT on the fly), buffer bar, volume,
  fullscreen, keyboard shortcuts (`space` `←` `→` `F` `M`), resume-from-where-you-left-off.
- **My List** and **Continue Watching**, stored locally — no account, no tracking, no cookies.
- Debounced streaming search, responsive down to 360 px, skeleton loading states, SEO metadata,
  sitemap + robots, OG tags.

**Engineering**
- Faithful TS port of the upstream provider: HMAC-MD5 `x-tr-signature`, `x-client-token`,
  randomised Android fingerprint, rotating 7-host pool, retry-on-status, visitor-login session with
  JWT expiry + `x-user` absorption, warm-lambda session reuse.
- Signed, expiring, range-aware media proxy (`/api/stream`) — the CDN needs Referer/Cookie headers a
  browser can't send cross-origin. HMAC signing keeps it from being an open proxy.
- Graceful degradation: if the provider is unreachable the UI renders a clearly-labelled
  **offline demo catalog** instead of an error page.
- CI runs typecheck + lint + build on every push; the sync job opens an issue if upstream drifts.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # optional — everything has defaults
npm run dev                     # http://localhost:3000
```

Other scripts:

| command | what it does |
| --- | --- |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run sync:upstream` | pull the newest MovieBox-Tui contract right now |
| `npm run install:workflows` | copy the shipped GitHub Actions into `.github/workflows/` |

---

## ⚠️ Provider access: the MovieBox edge blocks datacenter IPs

This is the single thing that decides whether you see the real catalog or the demo one.

Measured from the live deployment (`/api/debug/provider`):

| egress | request | response |
| --- | --- | --- |
| Vercel `iad1` (AWS us-east-1) | unsigned | `403 {"message":"Service not available in current region"}` |
| Vercel `iad1` | signed, all 7 hosts | `440 {"message":"ServiceNotAvailable"}` |
| Vercel `bom1` (AWS ap-south-1) | any headers, all 7 hosts | `440 {"message":"ServiceNotAvailable"}` |

Removing the signature, swapping the user-agent and dropping `x-forwarded-for` change nothing — the
edge keys off the **real TCP source IP**, and every Vercel region is a cloud ASN. The upstream TUI
works because its users run it from home connections.

**So: no Vercel region alone will reach the provider.** Set an egress proxy:

```bash
MOVIEBOX_PROXY_URL=http://user:pass@your-residential-proxy:8080
```

Every provider call, video byte and subtitle is routed through it. The exit IP must be
residential or mobile in a served region (South/Southeast Asia, Africa work; US/EU are refused).
Options: a residential-proxy service, a phone on mobile data running a proxy app, or a VPS on a
non-cloud ASN. Verify with **`/api/debug/provider`** — it reports every host, status and body, plus
whether the proxy is active.

Without it the app runs fine and looks complete, but on the bundled **offline demo catalog**
(amber badge, nothing playable).

---

## Deploy to Vercel

1. **Import the repo** — [vercel.com/new](https://vercel.com/new) → pick this repository.
   Framework preset is detected as **Next.js**; no build settings to change (`vercel.json` pins them).
2. **Name the project** `well-cinebox` → it serves at `https://well-cinebox.vercel.app`.
3. **Add environment variables** (Project → Settings → Environment Variables):

   | name | value | required |
   | --- | --- | --- |
   | `STREAM_SIGNING_SECRET` | `openssl rand -hex 32` | **yes, in production** |
   | `NEXT_PUBLIC_SITE_URL` | `https://well-cinebox.vercel.app` | recommended |
   | `MOVIEBOX_PROXY_URL` | residential/mobile HTTP(S) proxy | **yes, for a live catalog** — see above |
   | `MOVIEBOX_HOME_TAB` | `2` | no |
   | `MOVIEBOX_TIMEOUT_MS` | `12000` | no |
   | `CONTENT_CACHE_TTL_MS` | `300000` | no |
   | `STREAM_TOKEN_TTL_SEC` | `21600` | no |

4. **Deploy.** Vercel's Git integration then redeploys on every push — including the automated
   upstream-sync commits.
5. *(optional)* Create a **Deploy Hook** (Settings → Git → Deploy Hooks) and store the URL as the
   repository secret `VERCEL_DEPLOY_HOOK_URL`. The sync workflow pings it so a sync deploys even if
   Git-integration builds are paused.

Functions are pinned to `bom1` (Mumbai) in `vercel.json` — closest served region to the audience and
to a South-Asian proxy exit. Change `regions` if your proxy lives elsewhere.

> **Streaming note:** `/api/stream` relays video bytes through a Vercel Function. That's the only way
> to satisfy the CDN's Referer/Cookie requirements from a browser. It works on the Hobby plan but
> counts against function bandwidth — for heavy traffic, move that one route behind a dedicated
> relay (Cloudflare Worker, Fly.io, a small VPS) and point `proxyUrlFor()` at it.

---

## Staying connected to upstream

### One-time activation

The workflows ship in `automation/github-workflows/` and need to be copied into `.github/workflows/`
once, with your own credentials (GitHub only accepts workflow files from a token carrying the
`workflows` scope, which the bot that scaffolded this repo doesn't have):

```bash
npm run install:workflows
git add .github/workflows
git commit -m "ci: enable upstream sync + CI workflows"
git push
```

That's it — from then on it is fully automatic.

### What the sync does

`upstream-sync.yml` runs **every 3 hours** and on `workflow_dispatch`:

1. resolves `mesamirh/MovieBox-Tui@main` HEAD via the GitHub API,
2. downloads that exact tree and vendors the provider sources into `upstream/moviebox-tui/`,
3. parses the Rust and regenerates `lib/moviebox/generated/upstream-contract.ts`
   (host pool, HMAC secret bytes, retry codes, every `/wefeed-mobile-bff/...` endpoint,
   the Android fingerprint pools, stream referer, deprecated-URL markers),
4. runs `typecheck` + `build` so a breaking upstream change can never ship broken,
5. commits `chore(upstream): sync MovieBox-Tui @ <sha>` and pushes → Vercel redeploys,
6. opens/updates a GitHub issue labelled `upstream-sync` if parsing ever fails.

Run it by hand any time: **Actions → Upstream sync (MovieBox-Tui) → Run workflow**
(you can pass any upstream branch/tag/SHA), or locally with `npm run sync:upstream`.

Live status of what a deployment is running: **`/api/upstream`** · provider reachability:
**`/api/health`** · per-host probe: **`/api/debug/provider`**.

### Want a literal GitHub fork too?

This repo *tracks* upstream rather than being a GitHub fork (a fork of a Rust TUI can't host a
Next.js app at its root). If you also want the fork relationship on your account, open
<https://github.com/mesamirh/MovieBox-Tui> → **Fork** → then point the workflow at it:

```yaml
env:
  UPSTREAM_OWNER: your-username   # in automation/github-workflows/upstream-sync.yml
```

---

## Project layout

```
app/
  page.tsx                 home — hero + rails
  movies/ series/ trending/ my-list/ search/
  title/[id]/              details, cast, seasons & episodes
  watch/[id]/              player page
  api/
    play/                  resolves sources → signed proxy URLs
    stream/                range-aware signed media proxy
    subtitle/              subtitle proxy + SRT→VTT
    search/ health/ upstream/
components/                hero, rail, poster-card, player, header, footer, …
lib/
  moviebox/
    generated/upstream-contract.ts   ← AUTO-GENERATED from upstream
    signing.ts client.ts adapt.ts api.ts
  content.ts               live data + cache + offline fallback
  offline-catalog.ts       bundled demo metadata (clearly labelled in the UI)
  stream-token.ts          HMAC-signed proxy tokens
scripts/sync-upstream.mjs  the sync engine
automation/github-workflows/   upstream-sync.yml + ci.yml (run `npm run install:workflows`)
upstream/moviebox-tui/     vendored upstream sources (read-only mirror)
```

---

## Legal

well-cinebox hosts **no media**. It is a front-end for publicly reachable third-party endpoints, the
same ones the upstream open-source TUI client uses. Catalog data, artwork and streams belong to their
respective owners. Provided for personal and educational use; you are responsible for complying with
the laws of your jurisdiction. Upstream project is MIT/Apache-2.0 licensed — see
`upstream/moviebox-tui/LICENSE-MIT`.
