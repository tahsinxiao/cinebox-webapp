# CineBox

Next.js frontend and a Docker-ready Rust HTTP API adapting MovieBox-TUI. Work-in-progress: checks and production playback must be verified before merge/deployment.

## Start the frontend

Requires Node 22+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

With CINEBOX_API_URL blank, the app uses labeled demo mode: Big Buck Bunny and a synthetic two-episode Player Lab that repeats the same media. Click a title, Watch now, then Play. The sample URL comes from the hls.js upstream test fixture; availability is external and not guaranteed.

## Backend

```bash
cp .env.example .env
# Edit .env: use a random API_KEY of at least 24 characters.
# Enable ENABLE_MOVIEBOX only for content you are authorized to access.
docker compose up --build -d
```

For local frontend/backend connection, set CINEBOX_API_URL=http://127.0.0.1:8080 and CINEBOX_API_KEY to the backend API_KEY in .env.local, then restart Next.js.

Backend routes: GET /health, /catalog?q=...&page=1, /details?id=..., /streams?id=...&season=1&episode=1. Except health, requests require X-API-Key and ENABLE_MOVIEBOX=true. Movies use season/episode zero. Upstream is pinned to a reviewed revision in backend/Cargo.toml.

## Important limitations

Only direct HTTPS MP4/HLS/DASH sources without declared custom headers/cookies are returned. Many MovieBox sources may therefore be unavailable. Browser CORS, codec compatibility and URL expiry still need live testing. No authenticated media relay, DRM, external subtitle extraction, downloads or accounts are implemented. Embedded subtitle/audio support depends on the stream and player. The frontend plays media directly from its source, not through Vercel.

History is episode-specific and favorites are local to this device. Continue-watching cards open title details; select the recorded episode to resume. Next episode is selected after completion; playback uses browser controls rather than forced autoplay.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
cd backend
cargo test
cargo clippy -- -D warnings
cargo build --release
docker build -t cinebox-api:local .
```

Playwright checks UI/API wiring, not external CDN decoding. The proposed CI workflow is in docs/ci.yml because the connected GitHub integration currently cannot write .github/workflows. A repository administrator must copy it to .github/workflows/ci.yml or enable workflow-write permission, then run checks. No successful checks are claimed yet.

Version ranges are provisional. Generate and commit reviewed npm and Cargo lockfiles, pin Docker image digests, and switch to locked installs before production release.

## Deploy

1. After checks pass, deploy backend/Dockerfile to persistent container hosting with HTTPS, API_KEY, ENABLE_MOVIEBOX and PORT. Add gateway rate limits, monitoring and appropriate resource limits. Docker Compose binds localhost for development only.
2. Connect Vercel and import the repository as Next.js (root directory, npm install, npm run build).
3. Configure server-only CINEBOX_API_URL with the backend HTTPS origin and CINEBOX_API_KEY. Never use NEXT_PUBLIC_ for secrets. Redeploy after changes.
4. Validate catalog, source playback, seeking and episode resume in Chromium and Safari against authorized content. Without a backend URL the site remains in demo mode. Failed live requests are not replaced by demos.

GitHub Actions is for testing/building, not an always-on backend. No hosting service is connected or deployed by these commits.

## Licensing and privacy

MovieBox-TUI remains MIT OR Apache-2.0; retain upstream license files and third-party notices in backend distributions. The existing repository license governs original code. Code licenses do not grant access or redistribution rights to media/provider APIs. Big Buck Bunny attribution: Blender Foundation / Blender Institute. Demo fixture: https://github.com/video-dev/hls.js/blob/master/tests/test-streams.js .

The viewer's browser contacts media hosts, which can see its IP. Local history is not encrypted or synchronized. The server API key is not exposed to browser code; the public frontend API still requires production rate limiting. This is not a security audit.
