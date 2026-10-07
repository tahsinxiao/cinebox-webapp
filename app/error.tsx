"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[well-cinebox]", error);
  }, [error]);

  return (
    <div className="wrap grid min-h-[70vh] place-items-center pt-[var(--header-h)] text-center">
      <div className="max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[.24em] text-brand-300">Something broke</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.03em]">Playback interrupted</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/50">
          The provider returned an unexpected response. Retrying usually rotates to a healthy host.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn-brand">Try again</button>
          <Link href="/" className="btn-ghost">Back home</Link>
        </div>
      </div>
    </div>
  );
}
