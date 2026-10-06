'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { Stream } from '@/lib/contracts';
import { resumeSeconds } from '@/lib/history';
export default function Player({ stream, start, onProgress, onEnded }: { stream: Stream; start: number; onProgress: (seconds: number, duration: number) => void; onEnded: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onProgress, onEnded });
  callbacks.current = { onProgress, onEnded };
  const [error, setError] = useState('');
  const [qualities, setQualities] = useState<number[]>([]);
  const [quality, setQuality] = useState(-1);
  const [retry, setRetry] = useState(0);
  const hlsRef = useRef<Hls | null>(null);
  const last = useRef(0);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let disposed = false;
    let resetDash: (() => void) | undefined;
    let recovered = false;
    setError(''); setQualities([]); setQuality(-1);
    last.current = 0;
    const failure = () => setError('Playback failed. The source may be expired, blocked by CORS, or use an unsupported codec. Try another source.');
    const loaded = () => { if (start > 0) video.currentTime = resumeSeconds(start, video.duration); };
    const save = () => { if (Number.isFinite(video.duration)) callbacks.current.onProgress(video.currentTime, video.duration); };
    const tick = () => { if (Date.now() - last.current > 5000) { last.current = Date.now(); save(); } };
    const ended = () => { save(); callbacks.current.onEnded(); };
    video.addEventListener('loadedmetadata', loaded);
    video.addEventListener('error', failure);
    video.addEventListener('timeupdate', tick);
    video.addEventListener('pause', save);
    video.addEventListener('ended', ended);
    if (stream.format === 'hls' && Hls.isSupported()) {
      const hls = new Hls(); hlsRef.current = hls;
      hls.loadSource(stream.url); hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => setQualities(hls.levels.map(l => l.height)));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) { recovered = true; hls.recoverMediaError(); }
        else { failure(); hls.destroy(); }
      });
    } else if (stream.format === 'dash') {
      void import('dashjs').then(({ MediaPlayer }) => {
        if (disposed) return;
        const dash = MediaPlayer().create();
        resetDash = () => dash.reset();
        dash.on(MediaPlayer.events.ERROR, failure);
        dash.initialize(video, stream.url, false);
      }).catch(failure);
    } else if (stream.format !== 'hls' || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url; video.load();
    } else { setError('This browser does not support HLS playback.'); }
    return () => {
      disposed = true; save();
      video.removeEventListener('loadedmetadata', loaded); video.removeEventListener('error', failure);
      video.removeEventListener('timeupdate', tick); video.removeEventListener('pause', save); video.removeEventListener('ended', ended);
      hlsRef.current?.destroy(); hlsRef.current = null; resetDash?.();
      video.pause(); video.removeAttribute('src'); video.load();
    };
    // Resume position is read only on a new source; progress updates must not restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.url, stream.format, retry]);
  return <div className="player">
    <video ref={ref} controls playsInline preload="metadata" crossOrigin="anonymous" aria-label="Video player">
      {stream.subtitles.map(s => <track key={s.url} kind="subtitles" src={s.url} srcLang={s.language} label={s.label} />)}
    </video>
    {qualities.length > 0 && <label className="quality">Quality <select value={quality} onChange={e => { const level = Number(e.target.value); setQuality(level); if (hlsRef.current) hlsRef.current.currentLevel = level; }}><option value={-1}>Auto</option>{qualities.map((height, i) => <option key={i} value={i}>{height ? `${height}p` : `Level ${i + 1}`}</option>)}</select></label>}
    {error && <div className="notice" role="alert">{error} <button onClick={() => setRetry(v => v + 1)}>Retry</button></div>}
  </div>;
}
