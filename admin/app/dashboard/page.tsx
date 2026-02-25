import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

async function toggleListing(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const action = formData.get('action') as string;
    const status = action === 'hide' ? 'hidden' : 'active';
    await supabaseAdmin.from('listings').update({ status }).eq('id', id);
    revalidatePath('/dashboard');
}

async function getData() {
    const [users, listings, reports, trades, recentListings] = await Promise.all([
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabaseAdmin.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
        supabaseAdmin.from('trades').select('id', { count: 'exact', head: true }),
        supabaseAdmin
            .from('listings')
            .select('id, title, type, status, created_at, users(id, name), listing_photos(url)')
            .order('created_at', { ascending: false })
            .limit(8),
    ]);
    return {
        stats: {
            users: users.count ?? 0,
            listings: listings.count ?? 0,
            reports: reports.count ?? 0,
            trades: trades.count ?? 0,
        },
        recentListings: recentListings.data ?? [],
    };
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function initials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

const typeStyle: Record<string, string> = {
    cambio: 'bg-[#1D63ED]/20 text-[#4D8EFF]',
    trueque: 'bg-purple-500/20 text-purple-400',
    servicio: 'bg-orange-500/20 text-orange-400',
};

export default async function DashboardPage() {
    const { stats, recentListings } = await getData();

    const kpiCards = [
        {
            label: 'Total Users',
            value: stats.users.toLocaleString(),
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
            iconBg: 'bg-[#1D63ED]/20 text-[#1D63ED]',
            trend: '+12%',
            href: '/dashboard/users',
        },
        {
            label: 'Active Listings',
            value: stats.listings.toLocaleString(),
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
            iconBg: 'bg-purple-500/20 text-purple-400',
            trend: '+5%',
            href: '/dashboard/listings',
        },
        {
            label: 'Reported Items',
            value: stats.reports.toLocaleString(),
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
            iconBg: 'bg-orange-500/20 text-orange-400',
            trend: '+2%',
            href: '/dashboard/reports',
        },
        {
            label: 'Completed Trades',
            value: stats.trades.toLocaleString(),
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>,
            iconBg: 'bg-emerald-500/20 text-emerald-400',
            trend: '+15%',
            href: '/dashboard/listings',
        },
    ];

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Overview</h1>
                    <p className="text-sm text-gray-500 mt-1">Here&apos;s what&apos;s happening in the marketplace today.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151D29] border border-white/6 text-sm text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        Last 30 Days
                    </div>
                    <button className="px-4 py-2 rounded-xl bg-[#1D63ED] hover:bg-[#1855CC] text-white text-sm font-semibold transition-colors">
                        Generate Report
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {kpiCards.map((card) => (
                    <Link key={card.label} href={card.href}
                        className="bg-[#151D29] rounded-2xl p-5 hover:bg-[#1A2338] transition-colors group border border-white/5">
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                                {card.icon}
                            </div>
                            <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                {card.trend}
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                            </span>
                        </div>
                        <p className="text-gray-400 text-xs mb-1">{card.label}</p>
                        <p className="text-3xl font-bold text-white">{card.value}</p>
                    </Link>
                ))}
            </div>

            {/* Recent Listings Table */}
            <div className="bg-[#151D29] rounded-2xl border border-white/5">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="font-semibold text-white">Recent Listings</h2>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-[#0B111A] border border-white/8 rounded-xl px-4 py-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                            <input
                                type="text"
                                placeholder="Search title, user, or ID..."
                                className="bg-transparent text-sm text-white placeholder-gray-600 outline-none w-44"
                            />
                        </div>
                        <button className="p-2 rounded-xl bg-[#0B111A] border border-white/8 text-gray-500 hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
                        </button>
                    </div>
                </div>

                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Listing Details</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">User</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Type</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Date</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Quick Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                        {(recentListings as any[]).map((l) => {
                            const user = l.users as any;
                            const photos = l.listing_photos as any[];
                            const thumb = photos?.[0]?.url;
                            return (
                                <tr key={l.id} className="hover:bg-white/2 transition-colors group">
                                    {/* Listing Details */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-[#0B111A] flex-shrink-0 overflow-hidden border border-white/5">
                                                {thumb
                                                    ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                                    </div>
                                                }
                                            </div>
                                            <div>
                                                <p className="font-medium text-white text-sm truncate max-w-[160px]">{l.title}</p>
                                                <p className="text-[11px] text-gray-500">ID: #L-{l.id.slice(0, 4).toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {/* User */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-[#1D63ED]/30 flex items-center justify-center flex-shrink-0">
                                                <span className="text-[10px] font-bold text-[#4D8EFF]">{initials(user?.name)}</span>
                                            </div>
                                            <span className="text-sm text-gray-300">{user?.name ?? '—'}</span>
                                        </div>
                                    </td>
                                    {/* Type */}
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${typeStyle[l.type] ?? 'bg-gray-700 text-gray-300'}`}>
                                            {l.type === 'cambio' ? 'Fiat Swap' : l.type === 'trueque' ? 'Barter' : 'Service'}
                                        </span>
                                    </td>
                                    {/* Date */}
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-400">{timeAgo(l.created_at)}</span>
                                    </td>
                                    {/* Quick Actions */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {/* Approve / Check */}
                                            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                                            </button>
                                            {/* Hide toggle */}
                                            <form action={toggleListing} className="inline">
                                                <input type="hidden" name="id" value={l.id} />
                                                <input type="hidden" name="action" value={l.status === 'active' ? 'hide' : 'show'} />
                                                <button type="submit" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/8 transition-colors">
                                                    {l.status === 'active'
                                                        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                                        : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                    }
                                                </button>
                                            </form>
                                            {/* Delete */}
                                            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {recentListings.length === 0 && (
                    <div className="text-center py-16 text-gray-600">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                        <p className="text-sm">No listings yet</p>
                    </div>
                )}

                <div className="px-6 py-3 border-t border-white/5">
                    <Link href="/dashboard/listings" className="text-xs text-[#1D63ED] hover:text-blue-400 transition-colors">
                        View all listings →
                    </Link>
                </div>
            </div>
        </div>
    );
}
