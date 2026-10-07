"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PosterCard } from "./poster-card";
import type { CatalogRow } from "@/lib/types";

export function Rail({ row }: { row: CatalogRow }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 8,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
    });
  }, []);

  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  const nudge = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.86), behavior: "smooth" });
  };

  const isTop10 = row.kind === "top10";

  return (
    <section className="group/rail relative py-4 md:py-5">
      <div className="wrap mb-3 flex items-end justify-between gap-4">
        <h2 className="text-[15px] font-bold tracking-tight text-white/90 md:text-[19px]">
          {row.title}
          <span className="ml-2 align-middle text-[11px] font-medium text-white/35">{row.items.length}</span>
        </h2>
        <div className="hidden gap-1.5 md:flex">
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              aria-label={dir === -1 ? `Scroll ${row.title} left` : `Scroll ${row.title} right`}
              onClick={() => nudge(dir)}
              disabled={dir === -1 ? edges.start : edges.end}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-white/40 hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-25"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d={dir === -1 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {!edges.start && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-ink-950 to-transparent md:w-16" />
        )}
        {!edges.end && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-ink-950 to-transparent md:w-16" />
        )}
        <div ref={ref} onScroll={sync} className="rail-scroll wrap">
          {row.items.map((item, i) => (
            <PosterCard key={`${row.id}-${item.id}`} item={item} index={i} rank={isTop10 && i < 10 ? i + 1 : undefined} />
          ))}
        </div>
      </div>
    </section>
  );
}
