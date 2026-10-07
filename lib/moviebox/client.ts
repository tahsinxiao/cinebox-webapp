/**
 * MovieBox BFF client — TypeScript port of
 * `src/providers/moviebox/client.rs` (+ `session.rs`) from mesamirh/MovieBox-Tui.
 *
 * Features kept from upstream:
 *   • rotating host pool with sticky "active host" index
 *   • visitor-login session with JWT expiry parsing and `x-user` absorption
 *   • retry-on-status host rotation + 401/403 session invalidation
 *   • signed headers on every request
 */
import { HOST_POOL, RETRY_STATUS_CODES } from "./generated/upstream-contract";
import { buildSignedHeaders, generateClientIdentity, type ClientIdentity } from "./signing";

export class MovieBoxError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "status" | "hosts-exhausted" | "no-token" | "parse",
    readonly status?: number,
  ) {
    super(message);
    this.name = "MovieBoxError";
  }
}

interface Session {
  token: string;
  userId?: string;
  expiresAt?: number; // unix seconds
  createdAt: number; // unix seconds
}

const nowSec = () => Math.floor(Date.now() / 1000);

function sessionValid(s: Session | null): s is Session {
  if (!s || !s.token.trim()) return false;
  if (s.expiresAt) return nowSec() + 60 < s.expiresAt;
  return nowSec() < s.createdAt + 7 * 24 * 3600;
}

function parseJwtClaims(token: string): { uid?: string; exp?: number } {
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const rawUid = json.userId ?? json.uid ?? json.sub;
    const uid = rawUid === undefined || rawUid === null ? undefined : String(rawUid);
    const exp = typeof json.exp === "number" ? json.exp : undefined;
    return { uid, exp };
  } catch {
    return {};
  }
}

/**
 * Serverless-friendly singleton: warm Vercel lambdas reuse the visitor token
 * and the healthy-host pointer instead of re-authenticating per request.
 */
interface ClientState {
  session: Session | null;
  identity: ClientIdentity;
  activeHost: number;
  inflightLogin: Promise<string> | null;
}

const GLOBAL_KEY = Symbol.for("well-cinebox.moviebox.state");
function state(): ClientState {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      session: null,
      identity: generateClientIdentity(),
      activeHost: 0,
      inflightLogin: null,
    } satisfies ClientState;
  }
  return g[GLOBAL_KEY] as ClientState;
}

export const requestTimeoutMs = Number(process.env.MOVIEBOX_TIMEOUT_MS ?? 12_000);

export function userAgent(): string {
  return state().identity.userAgent;
}

function absorbXUser(headers: Headers) {
  const raw = headers.get("x-user");
  if (!raw) return;
  try {
    const json = JSON.parse(raw);
    const token: string | undefined = json?.token;
    if (!token) return;
    const claims = parseJwtClaims(token);
    const rawUid = json.uid ?? json.userId;
    state().session = {
      token,
      userId: rawUid === undefined || rawUid === null ? claims.uid : String(rawUid),
      expiresAt: claims.exp,
      createdAt: nowSec(),
    };
  } catch {
    /* ignore malformed x-user */
  }
}

async function requestHosts(
  method: "GET" | "POST",
  pathAndQuery: string,
  body: string | null,
  authToken: string | null,
): Promise<unknown> {
  const st = state();
  const start = st.activeHost;
  let backoffMs = 50;
  let lastStatus: number | undefined;

  for (let i = 0; i < HOST_POOL.length; i += 1) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = 50;
    }
    const idx = (start + i) % HOST_POOL.length;
    const url = `${HOST_POOL[idx]}${pathAndQuery}`;
    const headers = buildSignedHeaders(method, url, body, authToken, st.identity);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ?? undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      absorbXUser(res.headers);
      lastStatus = res.status;

      if (RETRY_STATUS_CODES.includes(res.status)) {
        st.activeHost = (idx + 1) % HOST_POOL.length;
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after"));
          backoffMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : 400;
        }
        continue;
      }
      if (!res.ok) throw new MovieBoxError(`API status ${res.status}`, "status", res.status);

      st.activeHost = idx;
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue; // malformed payload -> try next host, like upstream
      }
      const obj = parsed as Record<string, unknown> | null;
      return obj && typeof obj === "object" && "data" in obj ? obj.data : parsed;
    } catch (err) {
      if (err instanceof MovieBoxError && err.kind === "status") throw err;
      st.activeHost = (idx + 1) % HOST_POOL.length;
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new MovieBoxError(
    `all ${HOST_POOL.length} MovieBox hosts exhausted${lastStatus ? ` (last status ${lastStatus})` : ""}`,
    "hosts-exhausted",
    lastStatus,
  );
}

async function fetchFreshSession(): Promise<string> {
  const payload = (await requestHosts("POST", "/wefeed-mobile-bff/user-api/visitor-login", "{}", null)) as
    | Record<string, unknown>
    | null;
  const token = typeof payload?.token === "string" ? payload.token.trim() : "";
  if (!token) throw new MovieBoxError("visitor-login returned no token", "no-token");

  const claims = parseJwtClaims(token);
  const explicitUid = payload?.uid ?? payload?.userId;
  state().session = {
    token,
    userId: explicitUid === undefined || explicitUid === null ? claims.uid : String(explicitUid),
    expiresAt: claims.exp,
    createdAt: nowSec(),
  };
  return token;
}

export async function ensureSession(): Promise<string> {
  const st = state();
  if (sessionValid(st.session)) return st.session.token;
  if (st.inflightLogin) return st.inflightLogin;

  st.inflightLogin = fetchFreshSession().finally(() => {
    st.inflightLogin = null;
  });
  return st.inflightLogin;
}

export function invalidateSession() {
  state().session = null;
}

async function request(method: "GET" | "POST", pathAndQuery: string, body: string | null): Promise<unknown> {
  const token = await ensureSession();
  try {
    return await requestHosts(method, pathAndQuery, body, token);
  } catch (err) {
    const retryable =
      err instanceof MovieBoxError &&
      (err.kind === "hosts-exhausted" || err.status === 401 || err.status === 403);
    if (!retryable) throw err;
    invalidateSession();
    const fresh = await ensureSession();
    return requestHosts(method, pathAndQuery, body, fresh);
  }
}

export const mbGet = (pathAndQuery: string) => request("GET", pathAndQuery, null);
export const mbPost = (pathAndQuery: string, body: unknown) =>
  request("POST", pathAndQuery, JSON.stringify(body));
