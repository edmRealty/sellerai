import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './supabase/server';

export type UserRole = 'seller' | 'agent' | 'admin';

export type AuthContext = {
    supabase: SupabaseClient;
    user: User;
    role: UserRole;
};

/**
 * Resolve the authenticated user + role for a Route Handler.
 * Returns:
 *  - { configured: false }        Supabase env not set (prototype mode)
 *  - { configured: true, auth: null }   no valid session
 *  - { configured: true, auth }   authenticated
 */
export async function getAuthContext(): Promise<
    { configured: false; auth: null } | { configured: true; auth: AuthContext | null }
> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return { configured: false, auth: null };

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return { configured: true, auth: null };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

    const role: UserRole =
        profile?.role === 'agent' || profile?.role === 'admin' ? profile.role : 'seller';

    return { configured: true, auth: { supabase, user: data.user, role } };
}

export const isStaff = (role: UserRole) => role === 'agent' || role === 'admin';
