import { createClient } from '@supabase/supabase-js';

// NOTE: These environment variables must be set in .env.local
const isValidHttpUrl = (value: string) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

const rawSupabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
const supabaseUrl = isValidHttpUrl(rawSupabaseUrl) ? rawSupabaseUrl : '';
const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY2?.trim() ||
    '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("⚠️ Supabase Credentials Missing in `lib/supabaseAdmin.ts`. Admin functions will fail.");
}

// Admin Client with Service Role (Bypasses RLS)
// We use a fallback key to prevent build-time crashes if env vars are missing.
// Runtime calls will still fail auth if the key is invalid, which is desired.
export const supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseServiceKey || 'fallback-key-for-build',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);
