import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const method = request.method.toUpperCase();

    // Allow all API routes
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

    return NextResponse.next();
}

export const config = {
    matcher: '/:path*'
};
