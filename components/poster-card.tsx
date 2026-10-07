"use client";

import Link from "next/link";
import { useState } from "react";
import type { CatalogItem } from "@/lib/types";

const GRADIENTS = [
  "from-[#3b1e8c] via-[#1a1033] to-[#07060f]",
  "from-[#7b3dff] via-[#2d1668] to-[#07060f]",
  "from-[#0f3b6e] via-[#101a3a] to-[#07060f]",
  "from-[#6d1246] via-[#2a0f33] to-[#07060f]",
  "from-[#134e4a] via-[#0f2436] to-[#07060f]",
  "from-[#5b2110] via-[#2a1220] to-[#07060f]",
];

export function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function ArtworkFallback({ title, seed, className = "" }: { title: string; seed: string; className?: string }) {
  return (
    <div className={`relative flex h-full w-full items-end bg-gradient-to-br ${gradientFor(seed)} ${className}`}>
      <div className="absolute inset-0 opacity-[.18] [background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.5)_0_1px,transparent_1px_14px)]" />
      <div className="relative z-10 p-3">
        <p className="line-clamp-3 text-[13px] font-extrabold leading-tight tracking-tight text-white/95 drop-shadow">
          {title}
        </p>
      </div>
    </div>
  );
}

export function PosterCard({
  item,
  index,
  rank,
}: {
  item: CatalogItem;
  index?: number;
  rank?: number;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = !!item.poster && !broken;

  return (
    <Link
      href={`/title/${encodeURIComponent(item.id)}`}
      className="group relative block shrink-0 focus-visible:outline-none"
      style={{ animationDelay: `${Math.min((index ?? 0) * 28, 320)}ms` }}
    >
      <div className="flex items-end gap-1">
        {typeof rank === "number" && (
          <span
            aria-hidden
            className="-mr-4 select-none bg-gradient-to-b from-white/85 to-white/10 bg-clip-text text-[76px] font-black leading-[.72] text-transparent md:text-[104px]"
          >
            {rank}
          </span>
        )}
        <div className="relative w-[136px] overflow-hidden rounded-xl bg-ink-800 shadow-card ring-1 ring-white/10 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:ring-2 group-hover:ring-brand-300/70 group-focus-visible:ring-2 group-focus-visible:ring-brand-300 sm:w-[152px] md:w-[172px]">
          <div className="relative aspect-[2/3]">
            {showImg ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.poster}
                alt={item.title}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setBroken(true)}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
              />
            ) : (
              <ArtworkFallback title={item.title} seed={item.id} />
            )}

            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {item.rating && (
              <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur">
                ★ {item.rating}
              </span>
            )}
            <span className="absolute right-2 top-2 rounded-md bg-brand-600/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
              {item.type === "series" ? "Series" : "Movie"}
            </span>

            <div className="absolute inset-x-0 bottom-0 translate-y-2 p-2.5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <p className="line-clamp-2 text-[12px] font-bold leading-tight">{item.title}</p>
              <p className="mt-1 line-clamp-1 text-[10px] text-white/60">
                {[item.year, item.duration, item.genres?.[0]].filter(Boolean).join(" • ")}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-ink-950">
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
                  <path d="M8 5.5v13l10-6.5-10-6.5Z" />
                </svg>
                Play
              </span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 line-clamp-1 w-[136px] text-[12px] font-medium text-white/70 transition-colors group-hover:text-white sm:w-[152px] md:w-[172px]">
        {item.title}
      </p>
    </Link>
  );
}

export function PosterSkeleton() {
  return (
    <div className="shrink-0">
      <div className="skeleton aspect-[2/3] w-[136px] rounded-xl sm:w-[152px] md:w-[172px]" />
      <div className="skeleton mt-2 h-3 w-24 rounded" />
    </div>
  );
}
