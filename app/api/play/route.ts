import { NextResponse } from "next/server";
import { fetchPlay } from "@/lib/moviebox/api";
import { proxyUrlFor, subtitleUrlFor } from "@/lib/stream-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Resolves playable sources for a title/episode and hands the client
 * signed proxy URLs (never the raw CDN URL + cookies).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") ?? "").trim();
  const season = Number(searchParams.get("s") ?? 0) || 0;
  const episode = Number(searchParams.get("e") ?? 0) || 0;

  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  if (id.startsWith("offline-")) {
    return NextResponse.json(
      {
        sources: [],
        subtitles: [],
        offline: true,
        error:
          "This title comes from the bundled offline demo catalog and has no stream. Deploy with network access to the MovieBox provider for live playback.",
      },
      { status: 200 },
    );
  }

  try {
    const play = await fetchPlay(id, season, episode);
    return NextResponse.json({
      title: play.title,
      season: play.season,
      episode: play.episode,
      sources: play.sources.map((s) => ({
        id: s.id,
        quality: s.quality,
        resolution: s.resolution,
        format: s.format,
        codec: s.codec,
        sizeBytes: s.sizeBytes,
        src: proxyUrlFor({ url: s.url, headers: s.headers, kind: "video" }),
      })),
      subtitles: play.subtitles.map((t) => ({ label: t.label, lang: t.lang, src: subtitleUrlFor(t.url) })),
    });
  } catch (err) {
    return NextResponse.json(
      { sources: [], subtitles: [], error: err instanceof Error ? err.message : "Failed to resolve stream" },
      { status: 502 },
    );
  }
}
