import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { recordListingEvent } from "@/lib/listing-events";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getClientId, guardRateLimit, RateLimitError, rateLimitResponse } from "@/lib/api-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic"
};

const unauthorized = (configured: boolean) =>
  NextResponse.json({ configured, error: "unauthenticated" }, { status: 401 });

export async function POST(req: Request) {
  try {
    guardRateLimit({ bucket: "listing-photo-upload", id: getClientId(req), maxCalls: 10, windowMs: 60_000, blockMs: 60_000 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      const { retryAfterSeconds, headers } = rateLimitResponse(error);
      return NextResponse.json({ error: error.message, retryAfterSeconds }, { status: 429, headers });
    }
    throw error;
  }

  const ctx = await getAuthContext();
  if (!ctx.configured) return NextResponse.json({ configured: false, error: "not found" }, { status: 404 });
  if (!ctx.auth) return unauthorized(true);

  const form = await req.formData().catch(() => null);
  const listingId = typeof form?.get("listingId") === "string" ? String(form?.get("listingId")) : "";
  const file = form?.get("file");
  if (!listingId || !(file instanceof File)) {
    return NextResponse.json({ error: "listingId and photo file are required" }, { status: 400 });
  }
  if (!PHOTO_EXTENSIONS[file.type]) return NextResponse.json({ error: "unsupported photo type" }, { status: 415 });
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "photo exceeds 25 MB" }, { status: 413 });

  // The select is the ownership/staff authorization check under listing RLS.
  const { data: listing, error: listingError } = await ctx.auth.supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .maybeSingle();
  if (listingError) return NextResponse.json({ error: listingError.message }, { status: 500 });
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

  const extension = PHOTO_EXTENSIONS[file.type];
  const storagePath = `listings/${listingId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("photos")
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: document, error: documentError } = await ctx.auth.supabase
    .from("listing_documents")
    .insert({
      listing_id: listingId,
      kind: "photo",
      status: "uploaded",
      file_name: file.name.slice(0, 255),
      storage_path: storagePath
    })
    .select("id, kind, status, file_name, created_at")
    .single();
  if (documentError || !document) {
    await supabaseAdmin.storage.from("photos").remove([storagePath]);
    return NextResponse.json({ error: documentError?.message || "photo record failed" }, { status: 500 });
  }

  await recordListingEvent(ctx.auth.supabase, {
    listingId,
    actorId: ctx.auth.user.id,
    actorRole: ctx.auth.role,
    type: "photo_uploaded",
    payload: { documentId: document.id, fileName: document.file_name }
  });

  return NextResponse.json({ configured: true, photo: { ...document, has_file: true } }, { status: 201 });
}

export async function DELETE(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx.configured) return NextResponse.json({ configured: false, error: "not found" }, { status: 404 });
  if (!ctx.auth) return unauthorized(true);

  const documentId = new URL(req.url).searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  // RLS limits this read to the owner or staff before the service role deletes.
  const { data: document, error } = await ctx.auth.supabase
    .from("listing_documents")
    .select("id, listing_id, kind, storage_path")
    .eq("id", documentId)
    .eq("kind", "photo")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!document) return NextResponse.json({ error: "photo not found" }, { status: 404 });

  if (document.storage_path) {
    const { error: removeError } = await supabaseAdmin.storage.from("photos").remove([document.storage_path]);
    if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 });
  }
  const { error: deleteError } = await supabaseAdmin.from("listing_documents").delete().eq("id", document.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  await recordListingEvent(ctx.auth.supabase, {
    listingId: document.listing_id,
    actorId: ctx.auth.user.id,
    actorRole: ctx.auth.role,
    type: "photo_removed",
    payload: { documentId: document.id }
  });
  return NextResponse.json({ configured: true, removed: true });
}
