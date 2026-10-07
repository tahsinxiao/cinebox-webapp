"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProgress } from "@/lib/local-store";
import type { CatalogItem } from "@/lib/types";

interface ApiSource {
  id: string;
  quality: string;
  resolution: number;
  format: "mp4" | "dash" | "hls" | "other";
  codec?: string;
  sizeBytes?: number;
  src: string;
}
interface ApiSubtitle {
  label: string;
  lang?: string;
  src: string;
}
interface PlayResponse {
  title?: string;
  sources: ApiSource[];
  subtitles: ApiSubtitle[];
  error?: string;
  offline?: boolean;
}

const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

const fmtSize = (bytes?: number) =>
  !bytes ? null : bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;

export function Player({
  item,
  season,
  episode,
}: {
  item: CatalogItem;
  season?: number;
  episode?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [data, setData] = useState<PlayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controls, setControls] = useState(true);
  const [menu, setMenu] = useState<null | "quality" | "subs">(null);
  const [subtitle, setSubtitle] = useState(-1);
  const [fatal, setFatal] = useState<string | null>(null);

  /* ---------------------------------------------------------- fetch play */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFatal(null);
    const qs = new URLSearchParams({ id: item.id });
    if (season) qs.set("s", String(season));
    if (episode) qs.set("e", String(episode));

    fetch(`/api/play?${qs}`)
      .then((r) => r.json())
      .then((json: PlayResponse) => {
        if (!alive) return;
        setData(json);
        setSourceIdx(0);
        if (json.sources.length === 0) setFatal(json.error ?? "No playable source found for this title.");
      })
      .catch((err) => alive && setFatal(err instanceof Error ? err.message : "Failed to load stream"))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [item.id, season, episode]);

  /* ------------------------------------------------- attach source to <video> */
  const source = data?.sources[sourceIdx];

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;
    cleanupRef.current?.();
    cleanupRef.current = null;
    let disposed = false;

    (async () => {
      try {
        if (source.format === "dash") {
          const { MediaPlayer } = await import("dashjs");
          if (disposed) return;
          const player = MediaPlayer().create();
          player.initialize(video, source.src, true);
          cleanupRef.current = () => player.destroy();
        } else if (source.format === "hls" && !video.canPlayType("application/vnd.apple.mpegurl")) {
          const Hls = (await import("hls.js")).default;
          if (disposed) return;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(source.src);
            hls.attachMedia(video);
            cleanupRef.current = () => hls.destroy();
          } else {
            video.src = source.src;
          }
        } else {
          video.src = source.src;
          video.load();
        }
      } catch (err) {
        if (!disposed) setFatal(err instanceof Error ? err.message : "Playback engine failed to start");
      }
    })();

    return () => {
      disposed = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [source]);

  /* --------------------------------------------------------------- events */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      setTime(video.currentTime);
      if (video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onMeta = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setFatal("This source failed to load. Try another quality below.");
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
    };
  }, [source]);

  /* ------------------------------------------------------ progress saving */
  useEffect(() => {
    if (!duration || !playing) return;
    const t = setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.duration) return;
      saveProgress({ item, season, episode, position: video.currentTime / video.duration });
    }, 5000);
    return () => clearInterval(t);
  }, [duration, playing, item, season, episode]);

  /* ------------------------------------------------------------ fullscreen */
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
  }, []);

  /* --------------------------------------------------------------- hotkeys */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          toggle();
          break;
        case "ArrowRight":
          seekBy(10);
          break;
        case "ArrowLeft":
          seekBy(-10);
          break;
        case "f":
          void (document.fullscreenElement ? document.exitFullscreen() : shellRef.current?.requestFullscreen());
          break;
        case "m": {
          const v = videoRef.current;
          if (v) {
            v.muted = !v.muted;
            setMuted(v.muted);
          }
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seekBy]);

  const bumpControls = () => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 3200);
  };

  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div className="w-full">
      <div
        ref={shellRef}
        onMouseMove={bumpControls}
        onMouseLeave={() => playing && setControls(false)}
        className="group relative aspect-video w-full overflow-hidden rounded-none bg-black md:rounded-2xl md:ring-1 md:ring-white/10"
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          poster={item.backdrop ?? item.poster}
          playsInline
          onClick={toggle}
          className="h-full w-full bg-black"
          crossOrigin="anonymous"
        >
          {data?.subtitles.map((t, i) => (
            <track
              key={t.src}
              kind="subtitles"
              label={t.label}
              srcLang={t.lang ?? "en"}
              src={t.src}
              default={i === subtitle}
            />
          ))}
        </video>

        {(loading || (!source && !fatal)) && (
          <div className="absolute inset-0 grid place-items-center bg-black/70">
            <div className="flex flex-col items-center gap-3">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand-400" />
              <p className="text-[13px] text-white/60">Resolving stream…</p>
            </div>
          </div>
        )}

        {fatal && (
          <div className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center">
            <div className="max-w-md">
              <p className="text-lg font-bold text-white/90">Can’t play this right now</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/55">{fatal}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {data && data.sources.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setFatal(null);
                      setSourceIdx((i) => (i + 1) % data.sources.length);
                    }}
                  >
                    Try next source
                  </button>
                )}
                <Link href={`/title/${encodeURIComponent(item.id)}`} className="btn-brand">
                  Back to title
                </Link>
              </div>
            </div>
          </div>
        )}

        {!playing && !loading && !fatal && (
          <button
            type="button"
            aria-label="Play"
            onClick={toggle}
            className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/60 via-transparent to-black/30"
          >
            <span className="grid h-20 w-20 place-items-center rounded-full bg-white/90 text-ink-950 shadow-glow transition hover:scale-105">
              <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" fill="currentColor" aria-hidden>
                <path d="M8 5.5v13l10-6.5-10-6.5Z" />
              </svg>
            </span>
          </button>
        )}

        {/* ------------------------------------------------------- controls */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pb-3 pt-14 transition-opacity duration-300 md:px-5 md:pb-4 ${
            controls || !playing ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {/* seek bar */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(time)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              const video = videoRef.current;
              if (video && video.duration) video.currentTime = ratio * video.duration;
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") seekBy(5);
              if (e.key === "ArrowLeft") seekBy(-5);
            }}
            className="group/seek relative h-6 cursor-pointer"
          >
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
              <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${bufPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-300 to-brand-500" style={{ width: `${pct}%` }} />
            </div>
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white transition-transform group-hover/seek:scale-100"
              style={{ left: `${pct}%` }}
            />
          </div>

          <div className="mt-1 flex items-center gap-2 md:gap-3">
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/15">
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M8 5.5v13l10-6.5-10-6.5Z" />
                </svg>
              )}
            </button>

            <button type="button" onClick={() => seekBy(-10)} aria-label="Back 10 seconds" className="hidden h-9 w-9 place-items-center rounded-full text-white hover:bg-white/15 sm:grid">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 7 7 11l4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 11h6a5 5 0 1 1 0 10h-1" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" onClick={() => seekBy(10)} aria-label="Forward 10 seconds" className="hidden h-9 w-9 place-items-center rounded-full text-white hover:bg-white/15 sm:grid">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m13 7 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 11h-6a5 5 0 1 0 0 10h1" strokeLinecap="round" />
              </svg>
            </button>

            <div className="group/vol flex items-center gap-2">
              <button
                type="button"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                }}
                className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/15"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z" />
                  {!muted && volume > 0.05 && <path d="M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
                  {muted && <path d="M16 9.5 21 15M21 9.5 16 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
                </svg>
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setMuted(v === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = v === 0;
                  }
                }}
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 opacity-0 transition-all duration-300 group-hover/vol:w-20 group-hover/vol:opacity-100 accent-brand-300 md:w-16 md:opacity-100"
              />
            </div>

            <span className="ml-1 text-[12px] tabular-nums text-white/70">
              {fmtTime(time)} <span className="text-white/35">/ {fmtTime(duration)}</span>
            </span>

            <div className="ml-auto flex items-center gap-1">
              {data && data.subtitles.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Subtitles"
                    onClick={() => setMenu((m) => (m === "subs" ? null : "subs"))}
                    className={`grid h-9 w-9 place-items-center rounded-full hover:bg-white/15 ${subtitle >= 0 ? "text-brand-300" : "text-white"}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="M7 14h4M13 14h4" strokeLinecap="round" />
                    </svg>
                  </button>
                  {menu === "subs" && (
                    <Menu
                      title="Subtitles"
                      options={[{ label: "Off", value: -1 }, ...data.subtitles.map((t, i) => ({ label: t.label, value: i }))]}
                      active={subtitle}
                      onPick={(v) => {
                        setSubtitle(v);
                        const tracks = videoRef.current?.textTracks;
                        if (tracks) for (let i = 0; i < tracks.length; i += 1) tracks[i].mode = i === v ? "showing" : "disabled";
                        setMenu(null);
                      }}
                    />
                  )}
                </div>
              )}

              {data && data.sources.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenu((m) => (m === "quality" ? null : "quality"))}
                    className="rounded-full px-3 py-1.5 text-[12px] font-bold text-white hover:bg-white/15"
                  >
                    {source?.quality ?? "Auto"}
                  </button>
                  {menu === "quality" && (
                    <Menu
                      title="Quality"
                      options={data.sources.map((s, i) => ({
                        label: `${s.quality}${s.codec ? ` · ${s.codec}` : ""}${fmtSize(s.sizeBytes) ? ` · ${fmtSize(s.sizeBytes)}` : ""}`,
                        value: i,
                      }))}
                      active={sourceIdx}
                      onPick={(v) => {
                        setFatal(null);
                        setSourceIdx(v);
                        setMenu(null);
                      }}
                    />
                  )}
                </div>
              )}

              <button
                type="button"
                aria-label="Fullscreen"
                onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : shellRef.current?.requestFullscreen())}
                className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/15"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  {fullscreen ? (
                    <path d="M9 4v5H4M15 20v-5h5M20 9h-5V4M4 15h5v5" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {data && data.sources.length > 0 && (
        <p className="wrap mt-3 text-[11px] text-white/35">
          {data.sources.length} source{data.sources.length > 1 ? "s" : ""} available · streamed through the
          well-cinebox edge proxy · shortcuts: space, ← →, F, M
        </p>
      )}
    </div>
  );
}

function Menu({
  title,
  options,
  active,
  onPick,
}: {
  title: string;
  options: { label: string; value: number }[];
  active: number;
  onPick: (value: number) => void;
}) {
  return (
    <div className="absolute bottom-12 right-0 z-20 min-w-[200px] overflow-hidden rounded-xl border border-white/12 bg-ink-900/95 p-1.5 shadow-card backdrop-blur-xl">
      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-white/35">{title}</p>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[12px] transition ${
            active === o.value ? "bg-brand-500/25 text-white" : "text-white/70 hover:bg-white/10"
          }`}
        >
          <span className="truncate">{o.label}</span>
          {active === o.value && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
