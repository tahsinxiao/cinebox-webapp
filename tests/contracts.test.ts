import { describe, expect, it } from 'vitest';
import { requestSchema, streamSchema, catalogSchema } from '../lib/contracts';
import { demoItems, demoResponse } from '../lib/demo';
import { playbackKey, resumeSeconds } from '../lib/history';
describe('media contracts', () => {
  it('rejects path injection and invalid page values', () => {
    expect(requestSchema.safeParse({ action: 'details', id: '../secret' }).success).toBe(false);
    expect(requestSchema.safeParse({ page: -1 }).success).toBe(false);
    expect(requestSchema.safeParse({ action: 'streams' }).success).toBe(false);
  });
  it('rejects unsafe playback URLs', () => {
    expect(streamSchema.safeParse({ url: 'javascript:alert(1)', format: 'mp4', label: 'bad' }).success).toBe(false);
    expect(streamSchema.safeParse({ url: 'https://user:pass@example.com/video.mp4', format: 'mp4', label: 'bad' }).success).toBe(false);
  });
  it('labels demos and does not invent missing titles', () => {
    expect(catalogSchema.parse(demoResponse('catalog', '', '')).mode).toBe('demo');
    expect(demoResponse('details', '', 'not-real')).toBeNull();
    expect(demoItems[1].seasons?.[0].episodes).toHaveLength(2);
  });
});
describe('resume behavior', () => {
  it('isolates episodes', () => expect(playbackKey('a', 1, 1)).not.toBe(playbackKey('a', 1, 2)));
  it('resumes incomplete videos and resets completed ones', () => {
    expect(resumeSeconds(45, 100)).toBe(45);
    expect(resumeSeconds(95, 100)).toBe(0);
    expect(resumeSeconds(NaN, 100)).toBe(0);
  });
});
