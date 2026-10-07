import { Suspense } from "react";
import { Hero } from "@/components/hero";
import { Rail } from "@/components/rail";
import { OfflineBadge } from "@/components/brand";
import { ContinueWatching } from "@/components/continue-watching";
import { getHomeRows } from "@/lib/content";
import { PosterSkeleton } from "@/components/poster-card";
import type { CatalogItem, CatalogRow } from "@/lib/types";

export const revalidate = 300;

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
          <p className="text-[12px] text-white/45">
            Live MovieBox feed unreachable from this environment — showing the bundled demo catalog. Deployed on
            Vercel this rail set is replaced by the real catalog automatically.
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
