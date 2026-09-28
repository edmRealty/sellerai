import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { recordListingEvent } from '@/lib/listing-events';
import { getClientId, guardRateLimit, RateLimitError, rateLimitResponse } from '@/lib/api-safety';
import { buildListingDraft } from '@/lib/listing-draft';

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
    try {
        guardRateLimit({ bucket: 'listing-sync', id: getClientId(req), maxCalls: 30, windowMs: 60_000, blockMs: 60_000 });
    } catch (error) {
        if (error instanceof RateLimitError) {
            const { retryAfterSeconds, headers } = rateLimitResponse(error);
            return NextResponse.json({ synced: false, error: error.message, retryAfterSeconds }, { status: 429, headers });
        }
        throw error;
    }

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
    const data = body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
    const clientSessionId =
        typeof body?.clientSessionId === 'string' ? body.clientSessionId.slice(0, 128) : null;
    const requestedId = typeof body?.listingId === 'string' ? body.listingId.slice(0, 128) : null;

    // An explicit identity must never fall through to another listing.
    let existing: any = null;
    if (requestedId) {
        const { data: row, error } = await supabase
            .from('listings')
            .select('id, seller_id, status, step, working_price, consumer_notice_status, listing_agreement_status, data, updated_at')
            .eq('id', requestedId)
            .eq('seller_id', user.id)
            .maybeSingle();
        if (error) return NextResponse.json({ synced: false, error: 'listing_read_failed' }, { status: 503 });
        if (!row) return NextResponse.json({ synced: false, error: 'listing_not_found' }, { status: 404 });
        existing = row;
    } else {
        let query = supabase
            .from('listings')
            .select('id, seller_id, status, step, working_price, consumer_notice_status, listing_agreement_status, data, updated_at')
            .eq('seller_id', user.id)
            .neq('status', 'archived');
        if (clientSessionId) query = query.eq('client_session_id', clientSessionId);
        const { data: row, error } = await query
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) return NextResponse.json({ synced: false, error: 'listing_read_failed' }, { status: 503 });
        existing = row;
    }

    if (existing && !['draft', 'agent_review'].includes(existing.status)) {
        return NextResponse.json({ synced: false, error: 'listing_requires_staff_revision' }, { status: 409 });
    }
    const safeData = buildListingDraft(data, existing);
    const promoted = {
        address: typeof safeData.address === 'string' ? safeData.address.trim().slice(0, 512) : '',
        step,
        working_price: typeof safeData.finalPrice === 'number' && Number.isFinite(safeData.finalPrice) && safeData.finalPrice >= 0 ? safeData.finalPrice : null,
        data: safeData,
        client_session_id: clientSessionId
    };

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
            return NextResponse.json({ synced: false, error: 'listing_insert_failed' }, { status: 503 });
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

    if (!existing.updated_at) return NextResponse.json({ synced: false, error: 'listing_revision_missing' }, { status: 409 });
    const { data: updated, error: updateError } = await supabase
        .from('listings')
        .update(promoted)
        .eq('id', existing.id)
        .eq('seller_id', user.id)
        .eq('updated_at', existing.updated_at)
        .in('status', ['draft', 'agent_review'])
        .select('id')
        .maybeSingle();
    if (updateError) {
        return NextResponse.json({ synced: false, error: 'listing_update_failed' }, { status: 503 });
    }
    if (!updated) return NextResponse.json({ synced: false, error: 'listing_changed_reload_required' }, { status: 409 });

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
    return NextResponse.json({ configured: true, synced: true, listingId: existing.id });
}
