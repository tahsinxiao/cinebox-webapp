import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="well-cinebox home" className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 shadow-glow">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="currentColor" aria-hidden>
          <path d="M8 5.5v13l10-6.5-10-6.5Z" />
        </svg>
      </span>
      <span className="text-[17px] font-black leading-none tracking-[-.02em]">
        <span className="bg-gradient-to-r from-white via-brand-200 to-brand-400 bg-clip-text text-transparent">well</span>
        <span className="text-white">cinebox</span>
      </span>
    </Link>
  );
}

export function OfflineBadge({ reason }: { reason?: string }) {
  return (
    <div
      title={reason ? `Live MovieBox feed unavailable: ${reason}` : undefined}
      className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.16em] text-amber-200"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
      Offline demo catalog
    </div>
  );
}
