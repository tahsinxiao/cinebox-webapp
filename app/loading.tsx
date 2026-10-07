export default function Loading() {
  return (
    <div className="pt-[var(--header-h)]">
      <div className="skeleton h-[70vh] w-full" />
      <div className="wrap mt-8 space-y-8">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="skeleton mb-3 h-5 w-52 rounded" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="skeleton aspect-[2/3] w-[172px] shrink-0 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
