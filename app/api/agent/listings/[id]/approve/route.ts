import { NextResponse } from 'next/server';
import { getAuthContext, isStaff } from '@/lib/auth';
import { recordListingEvent } from '@/lib/listing-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApproveAction = 'approve-cn' | 'approve-listing';

/**
 * POST /api/agent/listings/[id]/approve
 * Body: { action: 'approve-cn' | 'approve-listing' }
 *
 * Staff-only server transaction: updates the listing's paperwork status
 * inside the stored ListingData, promotes the status column, and writes an
 * audit event traceable to the approving agent. The seller app picks the
 * change up via its wait-step polling.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const ctx = await getAuthContext();
    if (!ctx.configured) return NextResponse.json({ configured: false, ok: false });
    if (!ctx.auth) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    if (!isStaff(ctx.auth.role)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const { supabase, user, role } = ctx.auth;
    const listingId = params.id;

    let action: ApproveAction | null = null;
    try {
        const body = await req.json();
        if (body?.action === 'approve-cn' || body?.action === 'approve-listing') action = body.action;
    } catch {
        // handled below
    }
    if (!action) return NextResponse.json({ ok: false, error: 'invalid action' }, { status: 400 });

    const { data: listing, error: readError } = await supabase
        .from('listings')
        .select('id, data, consumer_notice_status, listing_agreement_status')
        .eq('id', listingId)
        .maybeSingle();
    if (readError || !listing) {
        return NextResponse.json({ ok: false, error: readError?.message ?? 'not found' }, { status: 404 });
    }

    const data = (listing.data ?? {}) as any;
    const paperwork = { ...(data.paperwork ?? {}) };
    const update: Record<string, unknown> = {};

    if (action === 'approve-cn') {
        paperwork.consumerNoticeStatus = 'signed';
        update.consumer_notice_status = 'signed';
    } else {
        paperwork.listingAgreementStatus = 'signed';
        update.listing_agreement_status = 'signed';
    }
    update.data = { ...data, paperwork };

    const { error: writeError } = await supabase.from('listings').update(update).eq('id', listingId);
    if (writeError) return NextResponse.json({ ok: false, error: writeError.message }, { status: 500 });

    await recordListingEvent(supabase, {
        listingId,
        actorId: user.id,
        actorRole: role,
        type: action === 'approve-cn' ? 'cn_approved' : 'la_approved',
        payload: { action }
    });

    return NextResponse.json({ configured: true, ok: true });
}
