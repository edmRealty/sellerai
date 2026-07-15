import { NextResponse } from "next/server";
import { getAuthContext, isStaff } from "@/lib/auth";
import { computeReadiness, getAllowedStatusTransitions, isListingStatus } from "@/lib/listing-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff-only publish-readiness view for the selected listing file. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.configured) return NextResponse.json({ configured: false, error: "not found" }, { status: 404 });
  if (!ctx.auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isStaff(ctx.auth.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { supabase } = ctx.auth;
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, status, address, working_price, consumer_notice_status, listing_agreement_status, data")
    .eq("id", params.id)
    .maybeSingle();
  if (listingError || !listing) return NextResponse.json({ error: listingError?.message || "not found" }, { status: 404 });

  const { data: documents, error: documentsError } = await supabase
    .from("listing_documents")
    .select("kind, status")
    .eq("listing_id", params.id)
    .limit(200);
  if (documentsError) return NextResponse.json({ error: documentsError.message }, { status: 500 });

  const status = isListingStatus(listing.status) ? listing.status : "draft";
  const checklist = computeReadiness(listing, documents ?? []);
  return NextResponse.json({
    configured: true,
    status,
    allowedNext: getAllowedStatusTransitions(status),
    checklist,
    failing: checklist.filter((item) => !item.ok)
  });
}
