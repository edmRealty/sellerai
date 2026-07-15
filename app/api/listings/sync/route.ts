import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { recordListingEvent } from '@/lib/listing-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/listings/sync
 * Body: { listingId?: string, clientSessionId?: string, step: string, data: ListingData }
 *
 * Upserts the authenticated seller's listing (RLS enforces ownership) and
 * records audit events for step advances and paperwork/price changes.
 * Returns { configured: false } when Supabase env is absent so the client
 * keeps its localStorage-only behavior.
 */
export async function POST(req: Request) {
    const ctx = await getAuthContext();
    if (!ctx.configured) return NextResponse.json({ configured: false, synced: false });
    if (!ctx.auth) return NextResponse.json({ configured: true, synced: false, error: 'unauthenticated' }, { status: 401 });

    const { supabase, user, role } = ctx.auth;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ synced: false, error: 'invalid body' }, { status: 400 });
    }

    const step = typeof body?.step === 'string' ? body.step.slice(0, 64) : 'confirm';
    const data = body?.data && typeof body.data === 'object' ? body.data : {};
    const clientSessionId =
        typeof body?.clientSessionId === 'string' ? body.clientSessionId.slice(0, 128) : null;
    const requestedId = typeof body?.listingId === 'string' ? body.listingId : null;

    const promoted = {
        address: typeof data?.address === 'string' ? data.address.slice(0, 512) : '',
        step,
        working_price: typeof data?.finalPrice === 'number' ? data.finalPrice : null,
        consumer_notice_status: data?.paperwork?.consumerNoticeStatus ?? 'not_sent',
        listing_agreement_status: data?.paperwork?.listingAgreementStatus ?? 'not_sent',
        data,
        client_session_id: clientSessionId
    };

    // Locate the existing row: explicit id, else this user's latest draft.
    let existing: any = null;
    if (requestedId) {
        const { data: row } = await supabase
            .from('listings')
            .select('id, step, working_price, consumer_notice_status, listing_agreement_status')
            .eq('id', requestedId)
            .maybeSingle();
        existing = row;
    }
    if (!existing) {
        const { data: row } = await supabase
            .from('listings')
            .select('id, step, working_price, consumer_notice_status, listing_agreement_status')
            .eq('seller_id', user.id)
            .neq('status', 'archived')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        existing = row;
    }

    if (!existing) {
        if (!promoted.address) {
            return NextResponse.json({ synced: false, error: 'empty address' }, { status: 400 });
        }
        const { data: inserted, error } = await supabase
            .from('listings')
            .insert({ ...promoted, seller_id: user.id })
            .select('id')
            .single();
        if (error || !inserted) {
            return NextResponse.json({ synced: false, error: error?.message ?? 'insert failed' }, { status: 500 });
        }
        await recordListingEvent(supabase, {
            listingId: inserted.id,
            actorId: user.id,
            actorRole: role,
            type: 'listing_created',
            payload: { address: promoted.address, step }
        });
        return NextResponse.json({ configured: true, synced: true, listingId: inserted.id });
    }

    const { error: updateError } = await supabase
        .from('listings')
        .update(promoted)
        .eq('id', existing.id);
    if (updateError) {
        return NextResponse.json({ synced: false, error: updateError.message }, { status: 500 });
    }

    // Audit meaningful transitions.
    if (existing.step !== step) {
        await recordListingEvent(supabase, {
            listingId: existing.id,
            actorId: user.id,
            actorRole: role,
            type: 'step_advanced',
            payload: { from: existing.step, to: step }
        });
    }
    if (existing.working_price !== promoted.working_price && promoted.working_price !== null) {
        await recordListingEvent(supabase, {
            listingId: existing.id,
            actorId: user.id,
            actorRole: role,
            type: 'price_changed',
            payload: { from: existing.working_price, to: promoted.working_price }
        });
    }
    if (existing.consumer_notice_status !== promoted.consumer_notice_status) {
        await recordListingEvent(supabase, {
            listingId: existing.id,
            actorId: user.id,
            actorRole: role,
            type: 'cn_status_changed',
            payload: { from: existing.consumer_notice_status, to: promoted.consumer_notice_status }
        });
    }
    if (existing.listing_agreement_status !== promoted.listing_agreement_status) {
        await recordListingEvent(supabase, {
            listingId: existing.id,
            actorId: user.id,
            actorRole: role,
            type: 'la_status_changed',
            payload: { from: existing.listing_agreement_status, to: promoted.listing_agreement_status }
        });
    }

    return NextResponse.json({ configured: true, synced: true, listingId: existing.id });
}
