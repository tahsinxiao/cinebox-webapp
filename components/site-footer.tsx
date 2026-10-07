import Link from "next/link";
import { UPSTREAM } from "@/lib/moviebox/generated/upstream-contract";
import { Wordmark } from "./brand";

export function SiteFooter() {
  const synced = new Date(UPSTREAM.syncedAt);
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/40">
      <div className="wrap grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-white/50">
            well-cinebox is a free movie &amp; series streaming front-end. Catalog, artwork and streams are
            provided by the MovieBox network through the open-source{" "}
            <Link href={UPSTREAM.url} className="text-brand-200 underline-offset-2 hover:underline">
              MovieBox-Tui
            </Link>{" "}
            provider contract. We host no media.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-white/40">Browse</h3>
          <ul className="space-y-2 text-[13px] text-white/60">
            {[
              ["/", "Home"],
              ["/series", "Series"],
              ["/movies", "Movies"],
              ["/trending", "Trending"],
              ["/my-list", "My List"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-white/40">Project</h3>
          <ul className="space-y-2 text-[13px] text-white/60">
            <li>
              <Link href={UPSTREAM.url} className="hover:text-white">
                Upstream repo
              </Link>
            </li>
            <li>
              <Link href="/api/upstream" className="hover:text-white">
                Sync status (JSON)
              </Link>
            </li>
            <li>
              <Link href="/api/health" className="hover:text-white">
                Provider health
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-white/40">Upstream sync</h3>
          <dl className="space-y-1.5 text-[12px] text-white/55">
            <div className="flex justify-between gap-3">
              <dt>Source</dt>
              <dd className="text-white/80">{UPSTREAM.repo}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Version</dt>
              <dd className="text-white/80">v{UPSTREAM.cargoVersion}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Commit</dt>
              <dd>
                <Link href={UPSTREAM.commitUrl} className="font-mono text-brand-200 hover:underline">
                  {UPSTREAM.shortCommit}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Synced</dt>
              <dd className="text-white/80">{synced.toISOString().slice(0, 10)}</dd>
            </div>
          </dl>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Auto-synced every 3h
          </p>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="wrap flex flex-col gap-2 py-5 text-[11px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} well-cinebox — Free Movie &amp; Series Streaming Webapp.</p>
          <p>Built on MovieBox-Tui · For personal, educational use only.</p>
        </div>
      </div>
    </footer>
  );
}
