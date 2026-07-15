import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/listings/events?listingId=...
 * Audit timeline for a listing. RLS restricts rows to the owning seller
 * and staff.
 */
export async function GET(req: Request) {
    const ctx = await getAuthContext();
    if (!ctx.configured) return NextResponse.json({ configured: false, events: [] });
    if (!ctx.auth) return NextResponse.json({ configured: true, events: [], error: 'unauthenticated' }, { status: 401 });

    const url = new URL(req.url);
    const listingId = url.searchParams.get('listingId');
    if (!listingId) return NextResponse.json({ events: [], error: 'listingId required' }, { status: 400 });

    const { data: events, error } = await ctx.auth.supabase
        .from('listing_events')
        .select('id, actor_id, actor_role, event_type, payload, created_at')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: true })
        .limit(500);

    if (error) return NextResponse.json({ events: [], error: error.message }, { status: 500 });
    return NextResponse.json({ configured: true, events: events ?? [] });
}
