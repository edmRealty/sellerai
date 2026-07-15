import { NextResponse } from "next/server";
import { getAuthContext, isStaff } from "@/lib/auth";
import { getClientId, guardRateLimit, RateLimitError, rateLimitResponse } from "@/lib/api-safety";
import { recordListingEvent } from "@/lib/listing-events";
import { computeReadiness, getAllowedStatusTransitions, isListingStatus, type ListingStatus } from "@/lib/listing-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requiresReadiness = (status: ListingStatus) => status === "approved" || status === "published";

/**
 * Staff-only listing state machine. Publication cannot be reached through a
 * client-side shortcut: the current state and readiness data are rechecked
 * here immediately before the database update.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    guardRateLimit({ bucket: "agent-listing-status", id: getClientId(req), maxCalls: 20, windowMs: 60_000, blockMs: 60_000 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      const { retryAfterSeconds, headers } = rateLimitResponse(error);
      return NextResponse.json({ ok: false, error: error.message, retryAfterSeconds }, { status: 429, headers });
    }
    throw error;
  }

  const ctx = await getAuthContext();
  if (!ctx.configured) return NextResponse.json({ configured: false, error: "not found" }, { status: 404 });
  if (!ctx.auth) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!isStaff(ctx.auth.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: { status?: unknown; override?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  if (!isListingStatus(body?.status)) {
    return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
  }

  const requestedStatus = body.status;
  const override = body?.override === true;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (override && !note) {
    return NextResponse.json({ ok: false, error: "An override note is required." }, { status: 400 });
  }

  const { supabase, user, role } = ctx.auth;
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, status, address, working_price, consumer_notice_status, listing_agreement_status, data")
    .eq("id", params.id)
    .maybeSingle();
  if (listingError || !listing) return NextResponse.json({ ok: false, error: listingError?.message || "not found" }, { status: 404 });

  const from = isListingStatus(listing.status) ? listing.status : "draft";
  const allowedNext = getAllowedStatusTransitions(from);
  if (!allowedNext.includes(requestedStatus)) {
    return NextResponse.json(
      { ok: false, error: "invalid transition", from, requestedStatus, allowedNext },
      { status: 422 }
    );
  }

  const { data: documents, error: documentsError } = await supabase
    .from("listing_documents")
    .select("kind, status")
    .eq("listing_id", params.id)
    .limit(200);
  if (documentsError) return NextResponse.json({ ok: false, error: documentsError.message }, { status: 500 });

  const checklist = computeReadiness(listing, documents ?? []);
  const failing = checklist.filter((item) => !item.ok);
  if (requiresReadiness(requestedStatus) && failing.length > 0 && !override) {
    return NextResponse.json(
      { ok: false, error: "listing is not ready", checklist, failing, allowedNext },
      { status: 422 }
    );
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({ status: requestedStatus })
    .eq("id", params.id);
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  await recordListingEvent(supabase, {
    listingId: params.id,
    actorId: user.id,
    actorRole: role,
    type: "status_changed",
    payload: {
      from,
      to: requestedStatus,
      ...(note ? { note } : {}),
      ...(override ? { override: true, failing, note } : {})
    }
  });

  return NextResponse.json({
    configured: true,
    ok: true,
    from,
    status: requestedStatus,
    checklist,
    failing,
    allowedNext: getAllowedStatusTransitions(requestedStatus),
    override
  });
}
