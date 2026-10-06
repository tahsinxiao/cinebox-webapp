import type { MediaItem } from './contracts';
// Test media URL documented by video-dev/hls.js/tests/test-streams.js.
export const demoStream = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
export const demoItems: MediaItem[] = [
  { id: 'big-buck-bunny', title: 'Big Buck Bunny', type: 'movie', year: '2008', description: 'A gentle giant takes on three woodland troublemakers. Blender Foundation open movie, played through the hls.js test stream.', genres: ['Animation', 'Short film'] },
  { id: 'player-lab', title: 'CineBox Player Lab', type: 'series', description: 'A synthetic series for testing episode navigation. Both episodes intentionally play the same Big Buck Bunny test stream. This is not a separate TV series.', genres: ['Demo'], seasons: [{ number: 1, episodes: [{ number: 1, title: 'Playback and quality' }, { number: 2, title: 'Resume and navigation' }] }] }
];
export function demoResponse(action: string, q: string, id: string) {
  if (action === 'catalog') return { mode: 'demo', items: demoItems.filter(i => i.title.toLowerCase().includes(q.toLowerCase())) };
  const item = demoItems.find(i => i.id === id);
  if (!item) return null;
  if (action === 'details') return { mode: 'demo', item };
  return { mode: 'demo', streams: [{ url: demoStream, label: 'Adaptive HLS test stream', format: 'hls', subtitles: [] }], warning: 'Demo media only. Player Lab episodes reuse the Big Buck Bunny sample.' };
}
