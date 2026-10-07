import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap grid min-h-[70vh] place-items-center pt-[var(--header-h)] text-center">
      <div className="max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[.24em] text-brand-300">404</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.03em]">We lost this one in the vault</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/50">
          The title you’re looking for isn’t in the catalog right now. It may have been removed upstream, or the
          link is out of date.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/" className="btn-brand">Back home</Link>
          <Link href="/search" className="btn-ghost">Search catalog</Link>
        </div>
      </div>
    </div>
  );
}
