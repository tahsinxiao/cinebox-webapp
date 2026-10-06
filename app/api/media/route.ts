import { NextRequest, NextResponse } from 'next/server';
import { catalogSchema, detailsSchema, playbackSchema, requestSchema } from '@/lib/contracts';
import { demoResponse } from '@/lib/demo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const parsed = requestSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  const { action, q, id, page, season, episode } = parsed.data;
  const base = process.env.CINEBOX_API_URL;
  if (!base) {
    const result = demoResponse(action, q, id);
    return NextResponse.json(result ?? { error: 'Title not found' }, { status: result ? 200 : 404 });
  }
  try {
    const origin = new URL(base);
    if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Invalid backend configuration');
    // User input cannot select an upstream host or path.
    const url = new URL(`/${action}`, origin);
    url.search = new URLSearchParams({ q, id, page: String(page), season: String(season), episode: String(episode) }).toString();
    const response = await fetch(url, {
      headers: { 'X-API-Key': process.env.CINEBOX_API_KEY ?? '' },
      signal: AbortSignal.timeout(45000), cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 403 ? 'Provider is disabled or the backend key is incorrect' : 'Provider unavailable. Please retry later.' }, { status: response.status === 403 ? 403 : 502 });
    const data: unknown = await response.json();
    const schema = action === 'catalog' ? catalogSchema : action === 'details' ? detailsSchema : playbackSchema;
    return NextResponse.json(schema.parse(data), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable or returned an invalid response. Demo mode is not substituted for live results.' }, { status: 502 });
  }
}
