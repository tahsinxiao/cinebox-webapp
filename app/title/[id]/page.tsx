import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodePicker } from "@/components/episode-picker";
import { Rail } from "@/components/rail";
import { TitleActions } from "@/components/title-actions";
import { OfflineBadge } from "@/components/brand";
import { ArtworkFallback, gradientFor } from "@/components/artwork";
import { getRelated, getTitle } from "@/lib/content";

export const revalidate = 600;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const res = await getTitle(decodeURIComponent(id));
  const t = res.data;
  if (!t) return { title: "Title not found" };
  return {
    title: `${t.title}${t.year ? ` (${t.year})` : ""}`,
    description: t.description?.slice(0, 180) ?? `Watch ${t.title} free on well-cinebox.`,
    openGraph: {
      title: t.title,
      description: t.description?.slice(0, 180),
      images: t.backdrop ?? t.poster ? [{ url: (t.backdrop ?? t.poster)! }] : undefined,
    },
  };
}

export default async function TitlePage({ params }: Params) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const res = await getTitle(id);
  const title = res.data;
  if (!title) notFound();

  const related = await getRelated(title);
  const firstEp = title.seasons[0]?.episodes[0];
  const watchHref =
    title.type === "series" && firstEp
      ? `/watch/${encodeURIComponent(id)}?s=${firstEp.season}&e=${firstEp.number}`
      : `/watch/${encodeURIComponent(id)}`;

  const art = title.backdrop ?? title.poster;
  const meta = [
    title.year,
    title.duration,
    title.type === "series" && title.seasons.length
      ? `${title.seasons.length} season${title.seasons.length > 1 ? "s" : ""}`
      : null,
    title.countries?.[0],
  ].filter(Boolean);

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {art ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={art} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover object-top opacity-60" />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${gradientFor(title.id)}`} />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_20%_40%,rgba(5,5,10,.95),rgba(5,5,10,.6)_55%,rgba(5,5,10,.3))]" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-ink-950 to-transparent" />
        </div>

        <div className="wrap grid gap-10 pb-14 pt-[calc(var(--header-h)+56px)] lg:grid-cols-[300px_1fr] lg:pt-[calc(var(--header-h)+80px)]">
          <div className="mx-auto w-[200px] overflow-hidden rounded-2xl shadow-card ring-1 ring-white/15 sm:w-[240px] lg:mx-0 lg:w-[300px]">
            <div className="aspect-[2/3]">
              {title.poster ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={title.poster} alt={title.title} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <ArtworkFallback title={title.title} seed={title.id} />
              )}
            </div>
          </div>

          <div className="animate-fade-up">
            {res.source === "offline" && (
              <div className="mb-4">
                <OfflineBadge reason={res.error} />
              </div>
            )}

            <h1 className="text-balance text-4xl font-black leading-[.98] tracking-[-.035em] sm:text-6xl">
              {title.title}
            </h1>
            {title.tagline && <p className="mt-3 text-[15px] italic text-white/55">{title.tagline}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="chip border-brand-300/40 bg-brand-500/20 text-brand-200">
                {title.type === "series" ? "Series" : "Movie"}
              </span>
              {title.rating && <span className="chip text-amber-200">★ {title.rating}</span>}
              {meta.map((m) => (
                <span key={String(m)} className="chip">
                  {m}
                </span>
              ))}
            </div>

            {title.genres && title.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {title.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/search?q=${encodeURIComponent(g)}`}
                    className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-medium text-white/60 transition hover:border-brand-300/60 hover:text-white"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}

            {title.description && (
              <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-white/75">{title.description}</p>
            )}

            <dl className="mt-6 grid max-w-2xl gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
              {title.director && (
                <div className="flex gap-2">
                  <dt className="text-white/40">Director</dt>
                  <dd className="text-white/80">{title.director}</dd>
                </div>
              )}
              {title.stars && title.stars.length > 0 && (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-white/40">Starring</dt>
                  <dd className="line-clamp-2 text-white/80">{title.stars.slice(0, 4).join(", ")}</dd>
                </div>
              )}
              {title.releaseDate && (
                <div className="flex gap-2">
                  <dt className="text-white/40">Released</dt>
                  <dd className="text-white/80">{title.releaseDate}</dd>
                </div>
              )}
              {title.dubs.length > 0 && (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-white/40">Audio</dt>
                  <dd className="line-clamp-2 text-white/80">{title.dubs.map((d) => d.language).join(", ")}</dd>
                </div>
              )}
            </dl>

            <div className="mt-8">
              <TitleActions item={title} watchHref={watchHref} />
            </div>
          </div>
        </div>
      </section>

      {title.type === "series" && title.seasons.length > 0 && <EpisodePicker id={id} seasons={title.seasons} />}

      {related.length > 0 && (
        <Rail row={{ id: "related", title: "More like this", kind: "rail", items: related }} />
      )}
    </>
  );
}
