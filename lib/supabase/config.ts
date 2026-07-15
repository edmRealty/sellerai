const isValidHttpUrl = (value: string) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

export const supabaseUrl = (() => {
    const raw =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim() ||
        '';
    return isValidHttpUrl(raw) ? raw : '';
})();

export const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    '';

export const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY2?.trim() ||
    '';

/** True when server-side Supabase persistence can be used. */
export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);
