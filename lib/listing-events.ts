import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from './auth';

export type ListingEventType =
    | 'listing_created'
    | 'step_advanced'
    | 'price_changed'
    | 'cn_status_changed'
    | 'la_status_changed'
    | 'cn_approved'
    | 'la_approved'
    | 'status_changed'
    | 'email_failed'
    | 'photo_uploaded'
    | 'photo_removed';

/**
 * Append an audit event. Best-effort: persistence failures are logged but
 * never break the seller/agent action itself.
 */
export async function recordListingEvent(
    supabase: SupabaseClient,
    params: {
        listingId: string;
        actorId?: string | null;
        actorRole?: UserRole | null;
        type: ListingEventType;
        payload?: Record<string, unknown>;
    }
) {
    const { error } = await supabase.from('listing_events').insert({
        listing_id: params.listingId,
        actor_id: params.actorId ?? null,
        actor_role: params.actorRole ?? null,
        event_type: params.type,
        payload: params.payload ?? {}
    });
    if (error) {
        console.warn('listing_events insert failed:', error.message);
    }
}
