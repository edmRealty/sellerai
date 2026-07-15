import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/download
 * Authorizes the caller through listing_documents RLS, then redirects to a
 * short-lived Storage URL. Raw bucket paths never leave the server response.
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.configured) return NextResponse.json({ configured: false, error: "not configured" }, { status: 503 });
  if (!ctx.auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: document, error } = await ctx.auth.supabase
    .from("listing_documents")
    .select("id, storage_path")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!document?.storage_path) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const { data: signedUrl, error: signedUrlError } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(document.storage_path, 60);

  if (signedUrlError || !signedUrl?.signedUrl) {
    console.warn("Document download URL creation failed:", signedUrlError?.message || "no signed URL");
    return NextResponse.json({ error: "document unavailable" }, { status: 404 });
  }

  const response = NextResponse.redirect(signedUrl.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
