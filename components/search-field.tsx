"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export function SearchField({ initial = "", suggestions = [] }: { initial?: string; suggestions?: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  // debounce → push to the URL so results stream in server-side
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const q = value.trim();
      startTransition(() => {
        router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
      });
    }, 400);
    return () => clearTimeout(t);
  }, [value, router]);

  return (
    <div className="max-w-xl">
      <div className="relative">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search titles, people, genres…"
          aria-label="Search the catalog"
          className="h-14 w-full rounded-2xl border border-white/15 bg-white/[.07] pl-12 pr-12 text-[15px] text-white placeholder:text-white/35 outline-none backdrop-blur transition focus:border-brand-300/70 focus:bg-white/[.12]"
        />
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" strokeLinecap="round" />
        </svg>
        {pending && (
          <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-brand-300" />
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue(s)}
              className="rounded-full border border-white/12 bg-white/[.05] px-3.5 py-1.5 text-[12px] text-white/60 transition hover:border-brand-300/60 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
