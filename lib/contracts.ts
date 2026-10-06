import { z } from 'zod';
export const httpsUrl = z.string().url().refine((s) => {
  const u = new URL(s);
  return u.protocol === 'https:' && !u.username && !u.password;
}, 'Expected an HTTPS URL without credentials');
export const itemSchema = z.object({
  id: z.string().min(1).max(200), title: z.string(), type: z.enum(['movie', 'series']),
  year: z.string().nullable().optional(), poster: httpsUrl.nullable().optional(),
  description: z.string().optional(), genres: z.array(z.string()).optional(),
  seasons: z.array(z.object({ number: z.number().int().nonnegative(), episodes: z.array(z.object({
    number: z.number().int().positive(), title: z.string().optional()
  })) })).optional()
});
export const streamSchema = z.object({
  url: httpsUrl, label: z.string(), format: z.enum(['hls', 'dash', 'mp4']),
  subtitles: z.array(z.object({ url: httpsUrl, language: z.string(), label: z.string() })).default([])
});
export const catalogSchema = z.object({ mode: z.enum(['demo', 'live']), items: z.array(itemSchema) });
export const detailsSchema = z.object({ mode: z.enum(['demo', 'live']), item: itemSchema });
export const playbackSchema = z.object({ mode: z.enum(['demo', 'live']), streams: z.array(streamSchema), warning: z.string().optional() });
export type MediaItem = z.infer<typeof itemSchema>;
export type Stream = z.infer<typeof streamSchema>;
export const requestSchema = z.object({
  action: z.enum(['catalog', 'details', 'streams']).default('catalog'),
  q: z.string().trim().max(120).default(''),
  id: z.string().max(200).regex(/^[A-Za-z0-9_-]*$/).default(''),
  page: z.coerce.number().int().min(1).max(100).default(1),
  season: z.coerce.number().int().min(0).max(1000).default(0),
  episode: z.coerce.number().int().min(0).max(10000).default(0)
}).superRefine((v, ctx) => {
  if (v.action !== 'catalog' && !v.id) ctx.addIssue({ code: 'custom', path: ['id'], message: 'ID is required' });
});
