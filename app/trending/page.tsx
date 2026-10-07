import type { Metadata } from "next";
import { Rail } from "@/components/rail";
import { PageHeading } from "@/components/grid";
import { OfflineBadge } from "@/components/brand";
import { getHomeRows } from "@/lib/content";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Trending",
  description: "What everyone is watching right now on well-cinebox.",
};

export default async function TrendingPage() {
  const home = await getHomeRows();
  const rows = [...home.data]
    .sort((a, b) => (b.kind === "top10" ? 1 : 0) - (a.kind === "top10" ? 1 : 0))
    .slice(0, 8);

  return (
    <>
      <PageHeading eyebrow="Right now" title="Trending" subtitle="The most-watched titles across the network this week.">
        {home.source === "offline" && <OfflineBadge reason={home.error} />}
      </PageHeading>
      <div className="pb-12">
        {rows.map((row) => (
          <Rail key={row.id} row={{ ...row, kind: row.kind === "hero" ? "rail" : row.kind }} />
        ))}
      </div>
    </>
  );
}
