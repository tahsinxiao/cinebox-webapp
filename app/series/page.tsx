import type { Metadata } from "next";
import { CardGrid, PageHeading } from "@/components/grid";
import { OfflineBadge } from "@/components/brand";
import { getCatalog } from "@/lib/content";

// Rendered per request, not at build time: Vercel builds in iad1 (US East),
// where the MovieBox BFF replies "Service not available in current region".
// Serving dynamically means the fetch runs in the function region (bom1),
// which the provider does serve. The in-process memo keeps it cheap.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Series",
  description: "Binge full seasons of the best series and TV shows, free on well-cinebox.",
};

export default async function SeriesPage() {
  const catalog = await getCatalog();
  const series = catalog.data.filter((i) => i.type === "series");

  return (
    <>
      <PageHeading
        eyebrow="Browse"
        title="Series & Shows"
        subtitle="Full seasons, every episode — prestige drama, comedy, documentary and anime."
      >
        {catalog.source === "offline" && <OfflineBadge reason={catalog.error} />}
      </PageHeading>
      <CardGrid items={series} />
    </>
  );
}
