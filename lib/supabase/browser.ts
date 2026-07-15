'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

/**
 * Browser Supabase client. Returns null when NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are not set, so the seller app can fall
 * back to its localStorage-only behavior.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
    if (client !== undefined) return client;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
    if (!url || !anonKey) {
        client = null;
        return client;
    }
    client = createBrowserClient(url, anonKey);
    return client;
}
