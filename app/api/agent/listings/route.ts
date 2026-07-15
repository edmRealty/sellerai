import { NextResponse } from 'next/server';
import { getAuthContext, isStaff } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/listings
 * Staff-only: all active listings for the agent portal.
 */
export async function GET() {
    const ctx = await getAuthContext();
    if (!ctx.configured) return NextResponse.json({ configured: false, listings: [] });
    if (!ctx.auth) return NextResponse.json({ configured: true, listings: [], error: 'unauthenticated' }, { status: 401 });
    if (!isStaff(ctx.auth.role)) return NextResponse.json({ configured: true, listings: [], error: 'forbidden' }, { status: 403 });

    const { data: listings, error } = await ctx.auth.supabase
        .from('listings')
        .select('id, seller_id, address, step, status, working_price, consumer_notice_status, listing_agreement_status, data, created_at, updated_at')
        .neq('status', 'archived')
        .order('updated_at', { ascending: false })
        .limit(200);

    if (error) return NextResponse.json({ listings: [], error: error.message }, { status: 500 });
    return NextResponse.json({ configured: true, listings: listings ?? [] });
}
