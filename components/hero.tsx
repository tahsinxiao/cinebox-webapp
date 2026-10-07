"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { gradientFor } from "./poster-card";
import type { CatalogItem } from "@/lib/types";

const ROTATE_MS = 9000;

export function Hero({ items }: { items: CatalogItem[] }) {
  const slides = useMemo(() => items.filter(Boolean).slice(0, 6), [items]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    timer.current = setInterval(() => setActive((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, slides.length]);

  if (slides.length === 0) return null;
  const item = slides[active];
  const art = item.backdrop ?? item.poster;
  const showArt = !!art && !broken[item.id];

  return (
    <section
      className="relative isolate min-h-[72vh] w-full overflow-hidden sm:min-h-[78vh] lg:min-h-[86vh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, i) => {
        const slideArt = slide.backdrop ?? slide.poster;
        const ok = !!slideArt && !broken[slide.id];
        return (
          <div
            key={slide.id}
            aria-hidden={i !== active}
            className={`absolute inset-0 transition-opacity duration-[900ms] ${i === active ? "opacity-100" : "opacity-0"}`}
          >
            {ok ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={slideArt}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setBroken((b) => ({ ...b, [slide.id]: true }))}
                className="h-full w-full scale-105 object-cover object-top"
              />
            ) : (
              <div className={`relative h-full w-full bg-gradient-to-br ${gradientFor(slide.id)}`}>
                <div className="absolute inset-0 opacity-[.07] [background-image:repeating-linear-gradient(115deg,rgba(255,255,255,.9)_0_1px,transparent_1px_22px)]" />
                <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_75%_30%,rgba(154,107,255,.45),transparent_70%)]" />
                <span
                  aria-hidden
                  className="absolute right-[-4%] top-1/2 hidden max-w-[62%] -translate-y-1/2 select-none text-right text-[12vw] font-black leading-[.82] tracking-[-.05em] text-white/[.06] md:block"
                >
                  {slide.title}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* scrims */}
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_18%_50%,rgba(5,5,10,.94),rgba(5,5,10,.55)_45%,rgba(5,5,10,.15)_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink-950/90 to-transparent" />

      <div className="wrap relative z-10 flex min-h-[72vh] flex-col justify-end pb-14 pt-[calc(var(--header-h)+40px)] sm:min-h-[78vh] lg:min-h-[86vh] lg:pb-20">
        <div key={item.id} className="max-w-2xl animate-fade-up">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="chip border-brand-300/40 bg-brand-500/20 text-brand-200">
              {item.type === "series" ? "Series" : "Movie"}
            </span>
            {item.rating && <span className="chip text-amber-200">★ {item.rating}</span>}
            {item.year && <span className="chip">{item.year}</span>}
            {item.duration && <span className="chip">{item.duration}</span>}
          </div>

          <h1 className="text-balance text-4xl font-black leading-[.95] tracking-[-.035em] drop-shadow-[0_6px_30px_rgba(0,0,0,.8)] sm:text-6xl lg:text-7xl">
            {item.title}
          </h1>

          {item.genres && item.genres.length > 0 && (
            <p className="mt-4 text-[13px] font-medium uppercase tracking-[.2em] text-brand-200/80">
              {item.genres.slice(0, 4).join("  ·  ")}
            </p>
          )}

          {item.description && (
            <p className="mt-4 line-clamp-3 max-w-xl text-[14px] leading-relaxed text-white/70 sm:text-[15px]">
              {item.description}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={`/watch/${encodeURIComponent(item.id)}`} className="btn-primary px-8">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M8 5.5v13l10-6.5-10-6.5Z" />
              </svg>
              Play
            </Link>
            <Link href={`/title/${encodeURIComponent(item.id)}`} className="btn-ghost">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
              </svg>
              More info
            </Link>
          </div>
        </div>

        {slides.length > 1 && (
          <div className="mt-10 flex items-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show ${slide.title}`}
                aria-current={i === active}
                onClick={() => setActive(i)}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  i === active ? "w-10 bg-white" : "w-5 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
