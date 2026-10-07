"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CardGrid, PageHeading } from "@/components/grid";
import { getMyList, onStoreChange } from "@/lib/local-store";
import type { CatalogItem } from "@/lib/types";

export default function MyListPage() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);

  useEffect(() => {
    const sync = () => setItems(getMyList());
    sync();
    return onStoreChange(sync);
  }, []);

  return (
    <>
      <PageHeading
        eyebrow="Your library"
        title="My List"
        subtitle="Titles you saved. Stored privately in this browser — no account, no tracking."
      />
      {items === null ? (
        <div className="wrap pb-20 text-white/40">Loading…</div>
      ) : (
        <CardGrid
          items={items}
          empty={
            <div className="mx-auto max-w-md">
              <p className="text-lg font-semibold text-white/80">Your list is empty</p>
              <p className="mt-2 text-sm text-white/45">
                Tap <span className="font-semibold text-white/70">+ My List</span> on any title to save it here.
              </p>
              <Link href="/" className="btn-brand mt-6">
                Browse the catalog
              </Link>
            </div>
          }
        />
      )}
    </>
  );
}
