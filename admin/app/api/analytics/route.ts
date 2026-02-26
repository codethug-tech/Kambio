import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    // Auth guard
    const cookieStore = await cookies();
    if (!cookieStore.get('kambio_admin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [users, activeListings, openReports, completedTrades, blockedUsers, totalTrades, totalMessages,
        recentUsers, recentListings, recentReports, recentTrades] = await Promise.all([
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
            supabaseAdmin.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
            supabaseAdmin.from('trades').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('is_blocked', true),
            supabaseAdmin.from('trades').select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('chat_messages').select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('users').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
            supabaseAdmin.from('listings').select('id, title, created_at').order('created_at', { ascending: false }).limit(5),
            supabaseAdmin.from('reports').select('id, reason, created_at').order('created_at', { ascending: false }).limit(5),
            supabaseAdmin.from('trades').select('id, status, created_at').order('created_at', { ascending: false }).limit(5),
        ]);

    return NextResponse.json({
        stats: {
            users: users.count ?? 0,
            activeListings: activeListings.count ?? 0,
            openReports: openReports.count ?? 0,
            completedTrades: completedTrades.count ?? 0,
            blockedUsers: blockedUsers.count ?? 0,
            totalTrades: totalTrades.count ?? 0,
            totalMessages: totalMessages.count ?? 0,
        },
        activity: {
            users: recentUsers.data ?? [],
            listings: recentListings.data ?? [],
            reports: recentReports.data ?? [],
            trades: recentTrades.data ?? [],
        },
    });
}
