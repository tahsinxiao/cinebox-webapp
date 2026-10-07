"use client";

import type { CatalogItem } from "./types";

const LIST_KEY = "wellcinebox:mylist:v1";
const PROGRESS_KEY = "wellcinebox:progress:v1";

export interface ProgressEntry {
  item: CatalogItem;
  season?: number;
  episode?: number;
  /** 0–1 */
  position: number;
  updatedAt: number;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("wellcinebox:store", { detail: key }));
  } catch {
    /* quota / private mode */
  }
}

export const getMyList = (): CatalogItem[] => read<CatalogItem[]>(LIST_KEY, []);

export const inMyList = (id: string): boolean => getMyList().some((i) => i.id === id);

export function toggleMyList(item: CatalogItem): boolean {
  const list = getMyList();
  const exists = list.some((i) => i.id === item.id);
  const next = exists ? list.filter((i) => i.id !== item.id) : [item, ...list].slice(0, 200);
  write(LIST_KEY, next);
  return !exists;
}

export const getProgress = (): ProgressEntry[] =>
  read<ProgressEntry[]>(PROGRESS_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);

export function saveProgress(entry: Omit<ProgressEntry, "updatedAt">) {
  const all = read<ProgressEntry[]>(PROGRESS_KEY, []).filter((e) => e.item.id !== entry.item.id);
  const next = [{ ...entry, updatedAt: Date.now() }, ...all].slice(0, 30);
  write(PROGRESS_KEY, next);
}

export function clearProgress(id: string) {
  write(
    PROGRESS_KEY,
    read<ProgressEntry[]>(PROGRESS_KEY, []).filter((e) => e.item.id !== id),
  );
}

export function onStoreChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("wellcinebox:store", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("wellcinebox:store", handler);
    window.removeEventListener("storage", handler);
  };
}
