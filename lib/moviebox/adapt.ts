/**
 * JSON → app model adapters, ported from
 * `src/providers/moviebox/adapt.rs` and `title.rs`.
 */
import type {
  AudioTrack,
  CatalogItem,
  CatalogRow,
  MediaType,
  SeasonRef,
  StreamSource,
  SubtitleTrack,
  TitleDetails,
} from "../types";
import { DEPRECATION_MARKERS, STREAM_REFERER } from "./generated/upstream-contract";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function str(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function num(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
}

function strList(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const out = v
      .map((x) => (typeof x === "string" ? x.trim() : obj(x) ? str(obj(x)!.name, obj(x)!.title) : undefined))
      .filter((x): x is string => !!x);
    return out.length ? out : undefined;
  }
  if (typeof v === "string" && v.trim()) {
    const out = v
      .split(/[,/|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return out.length ? out : undefined;
  }
  return undefined;
}

/** 4-digit year out of anything date-ish. */
export function extractYear(value: unknown): string | undefined {
  const s = str(value);
  if (!s) return undefined;
  const m = s.match(/(19|20)\d{2}/);
  return m ? m[0] : undefined;
}

const LANG_TAGS = [
  "hindi", "tamil", "telugu", "kannada", "malayalam", "bengali", "marathi", "punjabi", "gujarati",
  "urdu", "english", "spanish", "french", "german", "italian", "japanese", "korean", "chinese",
  "russian", "portuguese", "turkish", "arabic", "dub", "audio", "multi", "season",
];

/** Port of `clean_moviebox_title`. */
export function cleanTitle(raw: string): string {
  let title = (raw ?? "").trim();
  if (!title) return "";
  const original = title;

  while (title.startsWith("[")) {
    const close = title.indexOf("]");
    if (close === -1) break;
    const rest = title.slice(close + 1).trim();
    if (!rest) break;
    title = rest;
  }
  const openBracket = title.indexOf("[");
  if (openBracket > 0) title = title.slice(0, openBracket).trim();

  const openParen = title.indexOf("(");
  if (openParen > 0) {
    const inside = title.slice(openParen + 1).split(")")[0]?.trim() ?? "";
    const isYear = /^\d{4}$/.test(inside) && Number(inside) >= 1900 && Number(inside) <= 2099;
    if (!isYear) title = title.slice(0, openParen).trim();
  }

  const dashIdx = title.lastIndexOf(" - ");
  if (dashIdx > 0) {
    const suffix = title.slice(dashIdx + 3);
    const lower = suffix.toLowerCase();
    const isTag =
      LANG_TAGS.some((tag) => lower.includes(tag)) || /^s[\d-]+$/i.test(suffix);
    if (isTag) title = title.slice(0, dashIdx).trim();
  }

  const sIdx = title.lastIndexOf(" S");
  if (sIdx > 0) {
    const suffix = title.slice(sIdx + 2);
    if (/^\d[\dS-]*$/.test(suffix)) title = title.slice(0, sIdx).trim();
  }

  const seasonIdx = title.toLowerCase().lastIndexOf(" season ");
  if (seasonIdx > 0) title = title.slice(0, seasonIdx).trim();

  for (const sep of ["_", " ", ".", "-"]) {
    const pos = title.lastIndexOf(sep);
    if (pos > 0) {
      const suffix = title.slice(pos + 1);
      const m = suffix.match(/^(\d{3,4})[pP]$/);
      if (m && Number(m[1]) >= 144 && Number(m[1]) <= 8640) title = title.slice(0, pos).trim();
    }
  }

  const cleaned = title.replace(/[-:_.\s]+$/g, "").trim();
  return cleaned || original;
}

function imageFrom(source: Json | null, ...keys: string[]): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const v = source[key];
    if (typeof v === "string" && v.startsWith("http")) return v;
    const o = obj(v);
    if (o) {
      const u = str(o.url, o.thumbnail, o.image, o.src);
      if (u && u.startsWith("http")) return u;
    }
  }
  return undefined;
}

export function subjectToItem(value: unknown): CatalogItem | null {
  const s = obj(value);
  if (!s) return null;
  const id = str(s.subjectId, s.id, s.detailPath);
  if (!id) return null;

  const rawTitle = str(s.title, s.name, s.subjectTitle) ?? "Untitled";
  const stype = num(s.subjectType, s.stype) ?? 1;
  const type: MediaType = stype === 2 ? "series" : "movie";

  const poster =
    imageFrom(s, "cover", "coverVertical", "verticalCover", "image", "poster") ??
    str(s.coverUrl, s.pic, s.posterUrl);
  const backdrop =
    imageFrom(s, "horizontalCover", "coverHorizontal", "banner", "bannerImage", "stillUrl") ??
    str(s.coverHorizontalUrl, s.backdropUrl);

  return {
    id,
    title: cleanTitle(rawTitle),
    type,
    year: extractYear(s.releaseDate ?? s.year ?? s.releaseInfo),
    poster: poster?.startsWith("http") ? poster : undefined,
    backdrop: backdrop?.startsWith("http") ? backdrop : undefined,
    rating: (() => {
      const r = num(s.imdbRatingValue, s.rating, s.score, s.imdbRating);
      return r && r > 0 ? r.toFixed(1) : undefined;
    })(),
    genres: strList(s.genre ?? s.genres),
    description: str(s.description, s.intro, s.summary),
    seasonCount: num(s.season, s.seasonCount, s.maxSeason),
    duration: (() => {
      const d = num(s.duration);
      if (d && d > 0) return `${Math.round(d / 60)}m`;
      return str(s.durationText);
    })(),
    countries: strList(s.countryName ?? s.country ?? s.countries),
  };
}

/** Walks one homepage "operating" group and pulls every subject out of it. */
function groupSubjects(group: Json): unknown[] {
  const out: unknown[] = [];
  const banners = arr(obj(group.banner)?.banners ?? group.banners);
  for (const b of banners) {
    const bo = obj(b);
    if (!bo) continue;
    const subject = obj(bo.subject);
    if (subject) {
      // carry the banner artwork onto the subject for a nicer hero
      const art = imageFrom(bo, "image", "cover", "banner", "imageUrl");
      out.push(art ? { ...subject, bannerImage: art } : subject);
    }
  }
  for (const c of arr(obj(group.customData)?.items)) {
    const co = obj(c);
    if (co?.subject) out.push(co.subject);
    else if (co?.subjectId || co?.id) out.push(co);
  }
  for (const s of arr(group.subjects)) out.push(s);
  for (const s of arr(group.items)) {
    const so = obj(s);
    if (so?.subject) out.push(so.subject);
    else if (so?.subjectId) out.push(so);
  }
  for (const s of arr(group.list)) out.push(s);
  return out;
}

const ROW_TITLE_FALLBACKS = ["title", "name", "opsName", "moduleName", "moduleTitle", "tabName", "showName"];

/** `tab-operating` payload → homepage rows. */
export function homepageToRows(payload: unknown): CatalogRow[] {
  const root = obj(payload);
  const groups = Array.isArray(payload) ? payload : arr(root?.items ?? root?.ops ?? root?.list);
  const rows: CatalogRow[] = [];
  const seenGlobal = new Set<string>();

  groups.forEach((groupValue, gi) => {
    const group = obj(groupValue);
    if (!group) return;

    const isBanner = !!obj(group.banner) || arr(group.banners).length > 0;
    const title = str(...ROW_TITLE_FALLBACKS.map((k) => group[k])) ?? (isBanner ? "Featured" : `Collection ${gi + 1}`);

    const seenRow = new Set<string>();
    const items: CatalogItem[] = [];
    for (const subject of groupSubjects(group)) {
      const item = subjectToItem(subject);
      if (!item || seenRow.has(item.id)) continue;
      const so = obj(subject);
      if (so?.bannerImage && typeof so.bannerImage === "string") item.backdrop = so.bannerImage;
      seenRow.add(item.id);
      items.push(item);
    }
    if (items.length === 0) return;

    const fresh = items.filter((i) => !seenGlobal.has(i.id));
    // a rail made only of already-shown titles is noise; keep it only if big
    const finalItems = fresh.length >= 4 ? fresh : items;
    finalItems.forEach((i) => seenGlobal.add(i.id));

    rows.push({
      id: str(group.opsId, group.id, group.moduleId) ?? `row-${gi}`,
      title: cleanTitle(title),
      kind: isBanner ? "hero" : /top\s*10|trending/i.test(title) ? "top10" : "rail",
      items: finalItems,
    });
  });

  return rows;
}

/** `search/v2` payload → catalog items. */
export function searchToItems(payload: unknown): CatalogItem[] {
  const root = obj(payload);
  const results = arr(root?.results);
  const buckets: unknown[] = [];
  for (const r of results) {
    const ro = obj(r);
    for (const s of arr(ro?.subjects)) buckets.push(s);
  }
  if (buckets.length === 0) for (const s of arr(root?.list ?? root?.subjects)) buckets.push(s);

  const seen = new Set<string>();
  const items: CatalogItem[] = [];
  for (const b of buckets) {
    const item = subjectToItem(b);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

function seasonsFrom(subject: Json): SeasonRef[] {
  const container = obj(subject.seasons);
  const list = arr(container?.seasons ?? subject.seasons ?? container?.list);
  const seasons: SeasonRef[] = [];
  for (const s of list) {
    const so = obj(s);
    if (!so) continue;
    const number = num(so.se, so.season, so.seasonNumber) ?? 1;
    const episodes: SeasonRef["episodes"] = [];
    const epNumbers = arr(so.episodeNumbers);
    if (epNumbers.length) {
      for (const e of epNumbers) {
        const n = num(e);
        if (n) episodes.push({ season: number, number: n });
      }
    } else {
      const maxEp = num(so.maxEp, so.epCount, so.allEp) ?? 0;
      for (let i = 1; i <= maxEp; i += 1) episodes.push({ season: number, number: i });
    }
    if (episodes.length) seasons.push({ number, episodes });
  }
  seasons.sort((a, b) => a.number - b.number);
  return seasons;
}

export function detailsToTitle(payload: unknown): TitleDetails | null {
  const root = obj(payload);
  const subject = obj(root?.subject) ?? root;
  if (!subject) return null;
  const base = subjectToItem(subject);
  if (!base) return null;

  const dubs: AudioTrack[] = [];
  for (const d of arr(subject.dubs)) {
    const dd = obj(d);
    if (!dd) continue;
    const subjectId = str(dd.subjectId, dd.id);
    if (!subjectId) continue;
    const language = str(dd.lanName, dd.language, dd.lang) ?? "Unknown";
    dubs.push({ subjectId, language, label: str(dd.title, dd.name, dd.lanName) ?? language });
  }

  return {
    ...base,
    description: base.description ?? str(subject.description, subject.intro),
    tagline: str(subject.tagline),
    director: str(subject.director),
    stars: strList(subject.stars ?? subject.actors ?? subject.cast),
    releaseDate: str(subject.releaseDate),
    seasons: seasonsFrom(subject),
    dubs,
    backdrop:
      base.backdrop ??
      imageFrom(subject, "horizontalCover", "coverHorizontal", "banner", "stills") ??
      base.poster,
  };
}

/* ----------------------------------------------------------------- streams */

export const isDeprecationNoticeUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  if (lower.includes("macdn.aoneroom.com") && lower.includes("/other/")) return true;
  return DEPRECATION_MARKERS.filter((m) => m !== "macdn.aoneroom.com" && m !== "/other/").some((m) =>
    lower.includes(m.toLowerCase()),
  );
};

function decodeB64Padded(input: string): Buffer | null {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  try {
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
}

function toDashMpd(urlStr: string): string | null {
  const base = urlStr.replace(/\*+$/, "").replace(/\/+$/, "");
  return base.startsWith("http://") || base.startsWith("https://") ? `${base}/index.mpd` : null;
}

/** Port of `resolve_dash_manifest_from_policy`. */
export function resolveDashManifest(signCookie: string): string | null {
  for (const part of signCookie.split(";")) {
    const trimmed = part.trim();
    const prefixIdx = trimmed.indexOf("urlprefix=");
    if (prefixIdx !== -1) {
      const token = trimmed.slice(prefixIdx + "urlprefix=".length).split(":")[0]?.trim() ?? "";
      const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = decodeB64Padded(normalized);
      if (decoded) {
        const mpd = toDashMpd(decoded.toString("utf8"));
        if (mpd) return mpd;
      }
    }
    if (trimmed.startsWith("CloudFront-Policy=")) {
      const normalized = trimmed
        .slice("CloudFront-Policy=".length)
        .trim()
        .replace(/-/g, "+")
        .replace(/_/g, "=")
        .replace(/~/g, "/");
      const decoded = decodeB64Padded(normalized);
      if (!decoded) continue;
      try {
        const policy = JSON.parse(decoded.toString("utf8"));
        const resource = policy?.Statement?.[0]?.Resource;
        if (typeof resource === "string") {
          const mpd = toDashMpd(resource);
          if (mpd) return mpd;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function cleanCookie(signCookie: string): string {
  return signCookie
    .replace(/;+$/, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("; ");
}

/** `play-info/v2` payload → playable sources. */
export function playInfoToSources(payload: unknown, ua: string): { sources: StreamSource[]; title?: string } {
  const data = obj(payload);
  if (!data) return { sources: [] };
  const title = str(data.title);
  const streams = arr(data.streams);
  const sources: StreamSource[] = [];

  streams.forEach((streamValue, i) => {
    const stream = obj(streamValue);
    if (!stream) return;
    const id = str(stream.id) ?? `s${i}`;
    const format = (str(stream.format) ?? "MP4").toLowerCase();
    const codec = str(stream.codecName, stream.codec);
    const sizeBytes = num(stream.size);
    const signCookie = str(stream.signCookie) ?? "";
    const streamUrl = str(stream.url) ?? "";

    const direct = streamUrl.startsWith("http") && !isDeprecationNoticeUrl(streamUrl) ? streamUrl : null;
    const dash = resolveDashManifest(signCookie);
    // Browsers play progressive MP4 natively; prefer it, keep DASH as fallback.
    const chosen = direct ?? dash;
    if (!chosen) return;

    const headers: Record<string, string> = { Referer: STREAM_REFERER, "User-Agent": ua };
    if (signCookie) headers.Cookie = cleanCookie(signCookie);

    const resolution = num(stream.resolution) ?? Number((str(stream.resolutions) ?? "").split(",")[0]) ?? 0;
    const kind: StreamSource["format"] = chosen.endsWith(".mpd")
      ? "dash"
      : chosen.includes(".m3u8")
        ? "hls"
        : format.includes("mp4")
          ? "mp4"
          : "other";

    sources.push({
      id,
      url: chosen,
      quality: resolution ? `${resolution}p` : (str(stream.resolutions)?.split(",")[0] ?? "Auto") + (resolution ? "p" : ""),
      resolution: Number.isFinite(resolution) ? resolution : 0,
      format: kind,
      codec,
      sizeBytes,
      requiresProxy: true,
      headers,
    });

    if (dash && direct && dash !== direct) {
      sources.push({
        id: `${id}-dash`,
        url: dash,
        quality: resolution ? `${resolution}p DASH` : "DASH",
        resolution: Number.isFinite(resolution) ? resolution : 0,
        format: "dash",
        codec,
        sizeBytes,
        requiresProxy: true,
        headers,
      });
    }
  });

  return { sources, title };
}

/** `subject-api/resource` payload → extra direct sources. */
export function resourcesToSources(payload: unknown): StreamSource[] {
  const root = obj(payload);
  const list = arr(root?.list ?? root?.resources);
  const out: StreamSource[] = [];
  list.forEach((value, i) => {
    const item = obj(value);
    if (!item) return;
    const url = str(item.resourceLink, item.url);
    if (!url || !url.startsWith("http") || isDeprecationNoticeUrl(url)) return;
    const resolution = num(item.resolution) ?? 0;
    out.push({
      id: str(item.resourceId, item.id) ?? `r${i}`,
      url,
      quality: resolution ? `${resolution}p` : (str(item.fileName) ?? "Source"),
      resolution,
      format: url.includes(".m3u8") ? "hls" : url.includes(".mpd") ? "dash" : "mp4",
      codec: str(item.codecName, item.codec),
      sizeBytes: num(item.size),
      requiresProxy: true,
      headers: { Referer: STREAM_REFERER },
    });
  });
  return out;
}

export function captionsToSubtitles(payload: unknown): SubtitleTrack[] {
  const root = obj(payload);
  const captions = arr(root?.extCaptions);
  const seen = new Set<string>();
  const out: SubtitleTrack[] = [];
  for (const c of captions) {
    const co = obj(c);
    if (!co) continue;
    const url = str(co.url);
    if (!url || url.includes("aa348f2541d13ffe") || seen.has(url)) continue;
    const size = num(co.size) ?? 0;
    if (size > 0 && size <= 50) continue;
    const label = str(co.lanName, co.lan) ?? "Unknown";
    if (label.toLowerCase() === "in" && size <= 100) continue;
    seen.add(url);
    out.push({ label, url, lang: str(co.lan) });
  }
  return out;
}
