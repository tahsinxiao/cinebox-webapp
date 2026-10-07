import { verifyStreamToken } from "@/lib/stream-token";
import { STREAM_REFERER } from "@/lib/moviebox/generated/upstream-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SubRip → WebVTT (browsers only accept VTT in `<track>`). */
function srtToVtt(input: string): string {
  const body = input
    .replace(/\r+/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body.trim()}\n`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t");
  if (!token) return new Response("missing token", { status: 400 });

  const target = verifyStreamToken(token);
  if (!target) return new Response("invalid or expired token", { status: 403 });

  try {
    const res = await fetch(target.url, {
      headers: { referer: STREAM_REFERER, "user-agent": "Mozilla/5.0", accept: "*/*" },
      cache: "no-store",
    });
    if (!res.ok) return new Response("subtitle unavailable", { status: 502 });

    const text = await res.text();
    const vtt = text.trimStart().toUpperCase().startsWith("WEBVTT") ? text : srtToVtt(text);

    return new Response(vtt, {
      headers: {
        "content-type": "text/vtt; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      },
    });
  } catch {
    return new Response("subtitle fetch failed", { status: 502 });
  }
}
