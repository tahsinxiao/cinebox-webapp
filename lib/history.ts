import type { MediaItem } from './contracts';
export type Progress = { item: MediaItem; season: number; episode: number; seconds: number; duration: number; updated: number };
export function playbackKey(id: string, season: number, episode: number) { return `${id}:${season}:${episode}`; }
export function resumeSeconds(seconds: number, duration: number) {
  if (!Number.isFinite(seconds) || !Number.isFinite(duration) || seconds < 0 || duration <= 0) return 0;
  return seconds >= duration * 0.9 ? 0 : Math.min(seconds, duration - 1);
}
export function readStored<T>(key: string, fallback: T): T {
  try { const text = localStorage.getItem(key); return text ? JSON.parse(text) as T : fallback; } catch { return fallback; }
}
export function writeStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing or storage quota: playback remains usable. */ }
}
