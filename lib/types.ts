export type MediaType = "movie" | "series";

export interface CatalogItem {
  id: string;
  title: string;
  type: MediaType;
  year?: string;
  poster?: string;
  backdrop?: string;
  rating?: string;
  genres?: string[];
  description?: string;
  seasonCount?: number;
  duration?: string;
  countries?: string[];
}

export type RowKind = "hero" | "rail" | "top10";

export interface CatalogRow {
  id: string;
  title: string;
  kind: RowKind;
  items: CatalogItem[];
}

export interface EpisodeRef {
  season: number;
  number: number;
  title?: string;
  still?: string;
  overview?: string;
  duration?: string;
}

export interface SeasonRef {
  number: number;
  episodes: EpisodeRef[];
}

export interface AudioTrack {
  subjectId: string;
  language: string;
  label: string;
}

export interface TitleDetails extends CatalogItem {
  tagline?: string;
  director?: string;
  stars?: string[];
  seasons: SeasonRef[];
  dubs: AudioTrack[];
  releaseDate?: string;
}

export interface SubtitleTrack {
  label: string;
  url: string;
  lang?: string;
}

export interface StreamSource {
  id: string;
  /** Playable URL (MP4 progressive or DASH `.mpd`). */
  url: string;
  quality: string;
  resolution: number;
  format: "mp4" | "dash" | "hls" | "other";
  codec?: string;
  sizeBytes?: number;
  /** Upstream requires Referer/Cookie headers → must go through /api/stream. */
  requiresProxy: boolean;
  headers?: Record<string, string>;
}

export interface PlayPayload {
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
  title?: string;
  season?: number;
  episode?: number;
}

export interface CatalogResponse<T> {
  data: T;
  /** `live` = fresh from the MovieBox BFF, `offline` = bundled demo catalog. */
  source: "live" | "offline";
  error?: string;
  fetchedAt: string;
}
