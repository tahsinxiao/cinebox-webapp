/**
 * Content service: live MovieBox data with a graceful offline fallback and a
 * tiny in-process TTL cache (keeps warm Vercel lambdas from hammering the BFF).
 */
import "server-only";
import { DEFAULT_TAB, fetchDetails, fetchHomeRows, searchTitles } from "./moviebox/api";
import { OFFLINE_ITEMS, offlineItem, offlineRows, offlineSearch } from "./offline-catalog";
import type { CatalogItem, CatalogResponse, CatalogRow, TitleDetails } from "./types";

const TTL_MS = Number(process.env.CONTENT_CACHE_TTL_MS ?? 5 * 60 * 1000);

interface Entry<T> {
  value: T;
  expires: number;
}
const CACHE_KEY = Symbol.for("well-cinebox.content.cache");
function cache(): Map<string, Entry<unknown>> {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = new Map<string, Entry<unknown>>();
  return g[CACHE_KEY] as Map<string, Entry<unknown>>;
}

async function memo<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const c = cache();
  const hit = c.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  c.set(key, { value, expires: Date.now() + ttl });
  return value;
}

const stamp = () => new Date().toISOString();

function dedupeRows(rows: CatalogRow[]): CatalogRow[] {
  return rows
    .map((row) => ({ ...row, items: row.items.filter((i) => i.title && i.title !== "Untitled") }))
    .filter((row) => row.items.length >= 2);
}

/** Synthesise the rails HBO Max-style homepages always have. */
function enrichRows(rows: CatalogRow[]): CatalogRow[] {
  const all = new Map<string, CatalogItem>();
  for (const row of rows) for (const item of row.items) if (!all.has(item.id)) all.set(item.id, item);
  const items = [...all.values()];

  const extra: CatalogRow[] = [];
  const movies = items.filter((i) => i.type === "movie");
  const series = items.filter((i) => i.type === "series");
  const hasRow = (re: RegExp) => rows.some((r) => re.test(r.title));

  if (series.length >= 6 && !hasRow(/series|show|tv/i)) {
    extra.push({ id: "synth-series", title: "Series & Shows", kind: "rail", items: series.slice(0, 20) });
  }
  if (movies.length >= 6 && !hasRow(/movie|film/i)) {
    extra.push({ id: "synth-movies", title: "Movies", kind: "rail", items: movies.slice(0, 20) });
  }
  const topRated = items
    .filter((i) => i.rating && Number(i.rating) >= 7)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 20);
  if (topRated.length >= 6 && !hasRow(/top rated|critically/i)) {
    extra.push({ id: "synth-top-rated", title: "Critically Acclaimed", kind: "rail", items: topRated });
  }
  return [...rows, ...extra];
}

export async function getHomeRows(tabId: string = DEFAULT_TAB): Promise<CatalogResponse<CatalogRow[]>> {
  try {
    const rows = await memo(`home:${tabId}`, TTL_MS, async () => {
      const [p1, p2] = await Promise.allSettled([fetchHomeRows(tabId, 1), fetchHomeRows(tabId, 2)]);
      const merged = [
        ...(p1.status === "fulfilled" ? p1.value : []),
        ...(p2.status === "fulfilled" ? p2.value : []),
      ];
      if (merged.length === 0) throw new Error("empty homepage payload");
      return enrichRows(dedupeRows(merged));
    });
    if (rows.length === 0) throw new Error("no usable rows");
    return { data: rows, source: "live", fetchedAt: stamp() };
  } catch (err) {
    return {
      data: offlineRows(),
      source: "offline",
      error: err instanceof Error ? err.message : String(err),
      fetchedAt: stamp(),
    };
  }
}

export async function getSearch(query: string, page = 1): Promise<CatalogResponse<CatalogItem[]>> {
  const q = query.trim();
  if (!q) return { data: [], source: "live", fetchedAt: stamp() };
  try {
    const items = await memo(`search:${q.toLowerCase()}:${page}`, TTL_MS, () => searchTitles(q, page));
    return { data: items, source: "live", fetchedAt: stamp() };
  } catch (err) {
    return {
      data: offlineSearch(q),
      source: "offline",
      error: err instanceof Error ? err.message : String(err),
      fetchedAt: stamp(),
    };
  }
}

export async function getTitle(id: string): Promise<CatalogResponse<TitleDetails | null>> {
  if (id.startsWith("offline-")) {
    const item = offlineItem(id);
    return {
      data: item ? { ...item, seasons: [], dubs: [] } : null,
      source: "offline",
      fetchedAt: stamp(),
    };
  }
  try {
    const details = await memo(`title:${id}`, TTL_MS, () => fetchDetails(id));
    return { data: details, source: "live", fetchedAt: stamp() };
  } catch (err) {
    return {
      data: null,
      source: "offline",
      error: err instanceof Error ? err.message : String(err),
      fetchedAt: stamp(),
    };
  }
}

/** "More like this" — cheap related-titles heuristic over the home feed. */
export async function getRelated(item: CatalogItem, limit = 12): Promise<CatalogItem[]> {
  const home = await getHomeRows();
  const pool = new Map<string, CatalogItem>();
  for (const row of home.data) for (const i of row.items) if (i.id !== item.id) pool.set(i.id, i);
  if (pool.size === 0) for (const i of OFFLINE_ITEMS) if (i.id !== item.id) pool.set(i.id, i);

  const genres = new Set((item.genres ?? []).map((g) => g.toLowerCase()));
  const scored = [...pool.values()]
    .map((candidate) => {
      let score = 0;
      if (candidate.type === item.type) score += 2;
      for (const g of candidate.genres ?? []) if (genres.has(g.toLowerCase())) score += 3;
      if (candidate.year && item.year && Math.abs(Number(candidate.year) - Number(item.year)) <= 3) score += 1;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.candidate);
  return scored;
}

/** Flattened, de-duplicated view of the whole home feed (used by browse pages). */
export async function getCatalog(): Promise<CatalogResponse<CatalogItem[]>> {
  const home = await getHomeRows();
  const map = new Map<string, CatalogItem>();
  for (const row of home.data) for (const item of row.items) if (!map.has(item.id)) map.set(item.id, item);
  return { data: [...map.values()], source: home.source, error: home.error, fetchedAt: home.fetchedAt };
}
