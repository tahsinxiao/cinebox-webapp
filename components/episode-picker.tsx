"use client";

import Link from "next/link";
import { useState } from "react";
import type { SeasonRef } from "@/lib/types";

export function EpisodePicker({ id, seasons }: { id: string; seasons: SeasonRef[] }) {
  const [active, setActive] = useState(seasons[0]?.number ?? 1);
  const season = seasons.find((s) => s.number === active) ?? seasons[0];
  if (!season) return null;

  return (
    <section className="wrap pb-14">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold tracking-tight">Episodes</h2>
        {seasons.length > 1 && (
          <select
            value={active}
            onChange={(e) => setActive(Number(e.target.value))}
            aria-label="Select season"
            className="ml-auto rounded-xl border border-white/15 bg-ink-850 px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-brand-300"
          >
            {seasons.map((s) => (
              <option key={s.number} value={s.number}>
                Season {s.number}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {season.episodes.map((ep) => (
          <Link
            key={`${ep.season}-${ep.number}`}
            href={`/watch/${encodeURIComponent(id)}?s=${ep.season}&e=${ep.number}`}
            className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[.04] p-3 transition hover:border-brand-300/60 hover:bg-white/[.09]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500/40 to-brand-700/40 text-sm font-black text-white/90 transition group-hover:from-brand-400 group-hover:to-brand-600">
              {ep.number}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">
                {ep.title ?? `Episode ${ep.number}`}
              </span>
              <span className="block text-[11px] text-white/45">
                Season {ep.season}
                {ep.duration ? ` · ${ep.duration}` : ""}
              </span>
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/30 transition group-hover:text-white" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l10-6.5-10-6.5Z" />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}
