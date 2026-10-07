import { NextResponse } from "next/server";
import { getSearch } from "@/lib/content";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const page = Number(searchParams.get("page") ?? 1) || 1;

  if (!q) return NextResponse.json({ data: [], source: "live", fetchedAt: new Date().toISOString() });

  const res = await getSearch(q, page);
  return NextResponse.json(res, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
