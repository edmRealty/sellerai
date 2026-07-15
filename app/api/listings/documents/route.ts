import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/listings/documents?listingId=...
 * Lists authorized document metadata only. Storage paths remain server-only.
 */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx.configured) return NextResponse.json({ configured: false, documents: [] });
  if (!ctx.auth) {
    return NextResponse.json({ configured: true, documents: [], error: "unauthenticated" }, { status: 401 });
  }

  const listingId = new URL(req.url).searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ documents: [], error: "listingId required" }, { status: 400 });

  const { data: documents, error } = await ctx.auth.supabase
    .from("listing_documents")
    .select("id, kind, version, status, file_name, signed_at, created_at, storage_path")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ documents: [], error: error.message }, { status: 500 });

  return NextResponse.json({
    configured: true,
    documents: (documents ?? []).map(({ storage_path, ...document }) => ({
      ...document,
      has_file: Boolean(storage_path)
    }))
  });
}
