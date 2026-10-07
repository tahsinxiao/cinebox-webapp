import type { Metadata } from "next";
import { CardGrid, PageHeading } from "@/components/grid";
import { OfflineBadge } from "@/components/brand";
import { getCatalog } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Movies",
  description: "Stream free movies in HD on well-cinebox — blockbusters, indies and everything between.",
};

export default async function MoviesPage() {
  const catalog = await getCatalog();
  const movies = catalog.data.filter((i) => i.type === "movie");

  return (
    <>
      <PageHeading
        eyebrow="Browse"
        title="Movies"
        subtitle="Blockbusters, award winners and hidden gems — streaming free, no sign-up required."
      >
        {catalog.source === "offline" && <OfflineBadge reason={catalog.error} />}
      </PageHeading>
      <CardGrid items={movies} />
    </>
  );
}
