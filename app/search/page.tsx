import type { Metadata } from "next";
import { Suspense } from "react";
import { CardGrid, PageHeading } from "@/components/grid";
import { OfflineBadge } from "@/components/brand";
import { SearchField } from "@/components/search-field";
import { PosterSkeleton } from "@/components/poster-card";
import { getSearch } from "@/lib/content";

export const metadata: Metadata = {
  title: "Search",
  description: "Search thousands of free movies and series on well-cinebox.",
};

const SUGGESTIONS = ["Dune", "Breaking Bad", "Interstellar", "The Last of Us", "Oppenheimer", "Succession"];

async function Results({ query }: { query: string }) {
  const res = await getSearch(query);
  return (
    <>
      <div className="wrap pb-5">
        <p className="text-[13px] text-white/50">
          {res.data.length > 0
            ? `${res.data.length} result${res.data.length === 1 ? "" : "s"} for “${query}”`
            : `No results for “${query}”`}
        </p>
        {res.source === "offline" && (
          <div className="mt-3">
            <OfflineBadge reason={res.error} />
          </div>
        )}
      </div>
      <CardGrid
        items={res.data}
        empty={<p className="text-white/45">Try a different spelling, or search by genre.</p>}
      />
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="wrap grid grid-cols-2 justify-items-center gap-x-3 gap-y-7 pb-16 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {Array.from({ length: 16 }).map((_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  return (
    <>
      <PageHeading eyebrow="Find something" title="Search" subtitle="Movies, series, documentaries and more.">
        <SearchField initial={query} suggestions={SUGGESTIONS} />
      </PageHeading>

      {query ? (
        <Suspense key={query} fallback={<ResultsSkeleton />}>
          <Results query={query} />
        </Suspense>
      ) : (
        <div className="wrap pb-20 text-white/40">Start typing to search the catalog.</div>
      )}
    </>
  );
}
