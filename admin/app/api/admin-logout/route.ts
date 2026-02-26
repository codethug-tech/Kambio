import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    cookieStore.delete('kambio_admin');
    // Use absolute URL so redirect works in all environments
    return NextResponse.redirect(new URL('/', req.url));
}
