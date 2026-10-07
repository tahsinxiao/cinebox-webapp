import type { Metadata } from "next";
import { CardGrid, PageHeading } from "@/components/grid";
import { OfflineBadge } from "@/components/brand";
import { getCatalog } from "@/lib/content";

export const revalidate = 300;
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
