import { Suspense } from "react";
import { Hero } from "@/components/hero";
import { Rail } from "@/components/rail";
import { OfflineBadge } from "@/components/brand";
import { ContinueWatching } from "@/components/continue-watching";
import { getHomeRows } from "@/lib/content";
import { PosterSkeleton } from "@/components/poster-card";
import type { CatalogItem, CatalogRow } from "@/lib/types";

// Rendered per request, not at build time: Vercel builds in iad1 (US East),
// where the MovieBox BFF replies "Service not available in current region".
// Serving dynamically means the fetch runs in the function region (bom1),
// which the provider does serve. The in-process memo keeps it cheap.
export const dynamic = "force-dynamic";

function pickHero(rows: CatalogRow[]): { hero: CatalogItem[]; rest: CatalogRow[] } {
  const heroRow = rows.find((r) => r.kind === "hero" && r.items.length > 0);
  const source = heroRow ?? rows[0];
  if (!source) return { hero: [], rest: rows };

  const hero = [...source.items]
    .sort((a, b) => {
      const score = (i: CatalogItem) =>
        (i.backdrop ? 4 : 0) + (i.description ? 2 : 0) + (i.poster ? 1 : 0) + (i.rating ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, 6);

  const rest = heroRow ? rows.filter((r) => r.id !== heroRow.id) : rows;
  return { hero, rest };
}

function HomeSkeleton() {
  return (
    <div className="pt-[var(--header-h)]">
      <div className="skeleton h-[70vh] w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="py-5">
          <div className="wrap mb-3 h-5 w-48 skeleton rounded" />
          <div className="wrap flex gap-4">
            {Array.from({ length: 8 }).map((_, j) => (
              <PosterSkeleton key={j} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

async function HomeContent() {
  const home = await getHomeRows();
  const { hero, rest } = pickHero(home.data);

  return (
    <>
      <Hero items={hero} />

      {home.source === "offline" && (
        <div className="wrap -mt-6 mb-2 flex flex-wrap items-center gap-3">
          <OfflineBadge reason={home.error} />
          <p className="max-w-3xl text-[12px] leading-relaxed text-white/45">
            The MovieBox provider refuses datacenter traffic, so it can&rsquo;t be reached from this host and
            these rails are the bundled demo catalog. Point{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px] text-white/70">MOVIEBOX_PROXY_URL</code>{" "}
            at a residential or mobile egress and the live catalog loads automatically &mdash; see{" "}
            <a href="/api/debug/provider" className="text-brand-200 underline-offset-2 hover:underline">
              /api/debug/provider
            </a>{" "}
            for a per-host report.
          </p>
        </div>
      )}

      <div className="relative z-10 -mt-4 pb-10">
        <ContinueWatching />
        {rest.map((row) => (
          <Rail key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
