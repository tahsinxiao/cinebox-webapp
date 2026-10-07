import { PosterCard } from "./poster-card";
import type { CatalogItem } from "@/lib/types";

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="wrap pb-6 pt-[calc(var(--header-h)+40px)]">
      {eyebrow && (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.22em] text-brand-300">{eyebrow}</p>
      )}
      <h1 className="text-3xl font-black tracking-[-.03em] sm:text-5xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">{subtitle}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function CardGrid({ items, empty }: { items: CatalogItem[]; empty?: React.ReactNode }) {
  if (items.length === 0) {
    return (
      <div className="wrap py-20 text-center">
        {empty ?? <p className="text-white/45">Nothing here yet.</p>}
      </div>
    );
  }
  return (
    <div className="wrap grid grid-cols-2 justify-items-center gap-x-3 gap-y-7 pb-16 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {items.map((item, i) => (
        <PosterCard key={item.id} item={item} index={i} />
      ))}
    </div>
  );
}
