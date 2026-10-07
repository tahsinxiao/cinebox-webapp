import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Player } from "@/components/player";
import { EpisodePicker } from "@/components/episode-picker";
import { Rail } from "@/components/rail";
import { OfflineBadge } from "@/components/brand";
import { getRelated, getTitle } from "@/lib/content";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string; e?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const res = await getTitle(decodeURIComponent(id));
  return { title: res.data ? `Watch ${res.data.title}` : "Watch" };
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { id: rawId } = await params;
  const { s, e } = await searchParams;
  const id = decodeURIComponent(rawId);

  const res = await getTitle(id);
  const title = res.data;
  if (!title) notFound();

  const season = Number(s ?? 0) || undefined;
  const episode = Number(e ?? 0) || undefined;
  const related = await getRelated(title, 12);

  return (
    <div className="pt-[var(--header-h)]">
      <div className="bg-black">
        <div className="mx-auto w-full max-w-[1500px] md:px-6 md:pt-6">
          <Player item={title} season={season} episode={episode} />
        </div>
      </div>

      <section className="wrap py-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <Link
              href={`/title/${encodeURIComponent(id)}`}
              className="text-[11px] font-bold uppercase tracking-[.2em] text-brand-300 hover:text-brand-200"
            >
              ← Title details
            </Link>
            <h1 className="mt-2 text-2xl font-black tracking-[-.03em] sm:text-4xl">{title.title}</h1>
            <p className="mt-2 text-[13px] text-white/50">
              {[
                season && episode ? `Season ${season} · Episode ${episode}` : null,
                title.year,
                title.duration,
                title.genres?.slice(0, 3).join(", "),
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            {title.description && (
              <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-white/65">{title.description}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            {res.source === "offline" && <OfflineBadge reason={res.error} />}
            {title.rating && (
              <span className="rounded-xl border border-white/12 bg-white/[.05] px-4 py-2 text-sm font-bold text-amber-300">
                ★ {title.rating}
              </span>
            )}
          </div>
        </div>
      </section>

      {title.type === "series" && title.seasons.length > 0 && <EpisodePicker id={id} seasons={title.seasons} />}

      {related.length > 0 && <Rail row={{ id: "related", title: "More like this", kind: "rail", items: related }} />}
    </div>
  );
}
