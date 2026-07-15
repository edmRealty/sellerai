import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/listings/current[?listingId=...]
 * Returns the authenticated seller's listing (latest non-archived by default).
 * Used by the seller app to pick up agent approvals without a refresh.
 */
export async function GET(req: Request) {
    const ctx = await getAuthContext();
    if (!ctx.configured) return NextResponse.json({ configured: false, listing: null });
    if (!ctx.auth) return NextResponse.json({ configured: true, listing: null, error: 'unauthenticated' }, { status: 401 });

    const { supabase, user } = ctx.auth;
    const url = new URL(req.url);
    const listingId = url.searchParams.get('listingId');

    let query = supabase
        .from('listings')
        .select('id, address, step, status, working_price, consumer_notice_status, listing_agreement_status, data, updated_at');

    if (listingId) {
        query = query.eq('id', listingId);
    } else {
        query = query
            .eq('seller_id', user.id)
            .neq('status', 'archived')
            .order('updated_at', { ascending: false })
            .limit(1);
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ listing: null, error: error.message }, { status: 500 });

    return NextResponse.json({ configured: true, listing: rows?.[0] ?? null });
}
