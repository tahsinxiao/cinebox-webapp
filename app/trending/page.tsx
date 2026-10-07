import type { Metadata } from "next";
import { Rail } from "@/components/rail";
import { PageHeading } from "@/components/grid";
import { OfflineBadge } from "@/components/brand";
import { getHomeRows } from "@/lib/content";

// Rendered per request, not at build time: Vercel builds in iad1 (US East),
// where the MovieBox BFF replies "Service not available in current region".
// Serving dynamically means the fetch runs in the function region (bom1),
// which the provider does serve. The in-process memo keeps it cheap.
export const dynamic = "force-dynamic";
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
