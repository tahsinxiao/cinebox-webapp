"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { inMyList, onStoreChange, toggleMyList } from "@/lib/local-store";
import type { CatalogItem } from "@/lib/types";

export function TitleActions({ item, watchHref }: { item: CatalogItem; watchHref: string }) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setSaved(inMyList(item.id));
    sync();
    return onStoreChange(sync);
  }, [item.id]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={watchHref} className="btn-primary px-8">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M8 5.5v13l10-6.5-10-6.5Z" />
        </svg>
        Play
      </Link>

      <button type="button" onClick={() => setSaved(toggleMyList(item))} className="btn-ghost" aria-pressed={saved}>
        {mounted && saved ? (
          <>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            In My List
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            My List
          </>
        )}
      </button>

      <ShareButton title={item.title} />
    </div>
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Share"
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }
        } catch {
          /* dismissed */
        }
      }}
      className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition hover:border-white/50 hover:bg-white/20"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 10.6 6.8-4M8.6 13.4l6.8 4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
