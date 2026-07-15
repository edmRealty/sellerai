import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const method = request.method.toUpperCase();

    // Allow all API routes (they enforce auth themselves)
    if (pathname.startsWith('/api')) {
        return NextResponse.next();
    }

    // Allow Next static assets and common public files
    if (
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico' ||
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml'
    ) {
        return NextResponse.next();
    }

    // Absorb bot POSTs to page routes without surfacing 4xx in ELB health metrics
    if (method !== 'GET' && method !== 'HEAD') {
        return new NextResponse(null, { status: 204 });
    }

    // Without Supabase configured, behave exactly like the prototype.
    if (!supabaseConfigured) {
        return NextResponse.next();
    }

    // Refresh the Supabase session cookie on page loads.
    let response = NextResponse.next({ request });
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet: CookieToSet[]) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options)
                );
            }
        }
    });

    const {
        data: { user }
    } = await supabase.auth.getUser();

    // Gate the agent portal by role once Supabase is live.
    if (pathname.startsWith('/agent') && pathname !== '/agent/login') {
        if (!user) {
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = '/agent/login';
            loginUrl.search = '';
            return NextResponse.redirect(loginUrl);
        }
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
        if (profile?.role !== 'agent' && profile?.role !== 'admin') {
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = '/agent/login';
            loginUrl.search = '?denied=1';
            return NextResponse.redirect(loginUrl);
        }
    }

    return response;
}

export const config = {
    matcher: '/:path*'
};
