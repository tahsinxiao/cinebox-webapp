/**
 * High-level MovieBox API surface used by the webapp.
 * Endpoint shapes mirror `src/providers/moviebox/mod.rs` upstream.
 */
import "server-only";
import { mbGet, mbPost, userAgent } from "./client";
import {
  captionsToSubtitles,
  detailsToTitle,
  homepageToRows,
  playInfoToSources,
  resourcesToSources,
  searchToItems,
} from "./adapt";
import type { CatalogItem, CatalogRow, PlayPayload, TitleDetails } from "../types";

/** Homepage "operating" tab. Upstream TUI browses tab 2. */
export const DEFAULT_TAB = process.env.MOVIEBOX_HOME_TAB ?? "2";

export async function fetchHomeRows(tabId: string = DEFAULT_TAB, page = 1): Promise<CatalogRow[]> {
  const payload = await mbGet(`/wefeed-mobile-bff/tab-operating?page=${page}&tabId=${encodeURIComponent(tabId)}&version=`);
  return homepageToRows(payload);
}

export async function searchTitles(query: string, page = 1, perPage = 24): Promise<CatalogItem[]> {
  const payload = await mbPost("/wefeed-mobile-bff/subject-api/search/v2", {
    keyword: query,
    page,
    perPage,
    subjectType: 0,
  });
  return searchToItems(payload);
}

export async function fetchDetails(subjectId: string): Promise<TitleDetails | null> {
  const payload = (await mbGet(
    `/wefeed-mobile-bff/subject-api/get?subjectId=${encodeURIComponent(subjectId)}`,
  )) as Record<string, unknown> | null;
  if (!payload) return null;

  const subject = (payload.subject ?? payload) as Record<string, unknown>;
  const stype = Number(subject.subjectType ?? subject.stype ?? 1);
  if (stype === 2) {
    try {
      const seasonInfo = await mbGet(
        `/wefeed-mobile-bff/subject-api/season-info?subjectId=${encodeURIComponent(subjectId)}`,
      );
      if (seasonInfo) (subject as Record<string, unknown>).seasons = seasonInfo;
    } catch {
      /* season info is best-effort */
    }
  }
  return detailsToTitle(payload.subject ? payload : subject);
}

export async function fetchPlay(subjectId: string, season = 0, episode = 0): Promise<PlayPayload> {
  const qs =
    season > 0 && episode > 0
      ? `subjectId=${encodeURIComponent(subjectId)}&se=${season}&ep=${episode}`
      : `subjectId=${encodeURIComponent(subjectId)}`;

  const resourcePage = episode > 0 ? Math.floor((episode - 1) / 20) + 1 : 1;
  const resourceQs =
    season > 0 && episode > 0
      ? `subjectId=${encodeURIComponent(subjectId)}&se=${season}&ep=${episode}&page=${resourcePage}&perPage=20`
      : `subjectId=${encodeURIComponent(subjectId)}&page=1&perPage=20`;

  const [playInfo, resources] = await Promise.allSettled([
    mbGet(`/wefeed-mobile-bff/subject-api/play-info/v2?${qs}`),
    mbGet(`/wefeed-mobile-bff/subject-api/resource?${resourceQs}`),
  ]);

  const ua = userAgent();
  const primary =
    playInfo.status === "fulfilled" ? playInfoToSources(playInfo.value, ua) : { sources: [], title: undefined };
  const extra = resources.status === "fulfilled" ? resourcesToSources(resources.value) : [];

  const seen = new Set<string>();
  const sources = [...primary.sources, ...extra].filter((s) => {
    const key = s.url.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  sources.sort((a, b) => b.resolution - a.resolution || (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0));

  let subtitles: PlayPayload["subtitles"] = [];
  const resourceId = sources.find((s) => s.id && !s.id.startsWith("s"))?.id ?? sources[0]?.id;
  if (resourceId) {
    try {
      const caps = await mbGet(
        `/wefeed-mobile-bff/subject-api/get-ext-captions?subjectId=${encodeURIComponent(subjectId)}&resourceId=${encodeURIComponent(resourceId)}`,
      );
      subtitles = captionsToSubtitles(caps);
    } catch {
      /* captions are optional */
    }
  }

  return { sources, subtitles, title: primary.title, season, episode };
}
