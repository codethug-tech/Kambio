import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
    const admin = req.cookies.get('kambio_admin')?.value;
    const { pathname } = req.nextUrl;

    // Public: login page and admin-auth API
    if (pathname === '/' || pathname.startsWith('/api/admin-auth')) {
        return NextResponse.next();
    }

    // Protected: everything else
    if (!admin) {
        return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
