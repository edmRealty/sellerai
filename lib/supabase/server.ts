import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './config';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Cookie-session Supabase client for Route Handlers / Server Components.
 * Returns null when Supabase is not configured so callers can degrade
 * gracefully (the app then behaves as the localStorage-only prototype).
 */
export function createSupabaseServerClient() {
    if (!isSupabaseConfigured()) return null;
    const cookieStore = cookies();
    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet: CookieToSet[]) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // Called from a Server Component; middleware refreshes sessions.
                }
            }
        }
    });
}
