"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearProgress, getProgress, onStoreChange, type ProgressEntry } from "@/lib/local-store";
import { gradientFor } from "./poster-card";

export function ContinueWatching() {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    const sync = () => setEntries(getProgress().filter((e) => e.position > 0.01 && e.position < 0.96));
    sync();
    return onStoreChange(sync);
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="py-4 md:py-5">
      <div className="wrap mb-3 flex items-end justify-between">
        <h2 className="text-[15px] font-bold tracking-tight text-white/90 md:text-[19px]">Continue Watching</h2>
      </div>
      <div className="rail-scroll wrap">
        {entries.map(({ item, position, season, episode }) => {
          const href = `/watch/${encodeURIComponent(item.id)}${season && episode ? `?s=${season}&e=${episode}` : ""}`;
          return (
            <div key={item.id} className="group relative w-[260px] shrink-0 sm:w-[300px]">
              <Link href={href} className="block overflow-hidden rounded-xl ring-1 ring-white/10 transition group-hover:ring-2 group-hover:ring-brand-300/70">
                <div className="relative aspect-video">
                  {item.backdrop || item.poster ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.backdrop ?? item.poster}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${gradientFor(item.id)}`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink-950">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                        <path d="M8 5.5v13l10-6.5-10-6.5Z" />
                      </svg>
                    </span>
                  </div>
                  <div className="absolute inset-x-3 bottom-3">
                    <p className="line-clamp-1 text-[13px] font-bold">{item.title}</p>
                    <p className="text-[11px] text-white/55">
                      {season && episode ? `S${season} E${episode} · ` : ""}
                      {Math.round(position * 100)}% watched
                    </p>
                    <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.round(position * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                aria-label={`Remove ${item.title} from Continue Watching`}
                onClick={() => clearProgress(item.id)}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white/70 opacity-0 transition hover:text-white group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
