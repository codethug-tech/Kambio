'use client';

import { useEffect, useState, useCallback } from 'react';

type Stats = {
    users: number;
    activeListings: number;
    openReports: number;
    completedTrades: number;
    blockedUsers: number;
    totalTrades: number;
    totalMessages: number;
};

type Activity = {
    id: string;
    type: 'user' | 'listing' | 'report' | 'trade';
    label: string;
    sub: string;
    ts: string;
};

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const activityIcon: Record<Activity['type'], React.ReactElement> = {
    user: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    ),
    listing: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
    ),
    report: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    trade: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
};

const activityColor: Record<Activity['type'], string> = {
    user: 'bg-[#1D63ED]/20 text-[#1D63ED]',
    listing: 'bg-purple-500/20 text-purple-400',
    report: 'bg-orange-500/20 text-orange-400',
    trade: 'bg-emerald-500/20 text-emerald-400',
};

export default function AnalyticsPage() {
    const [stats, setStats] = useState<Stats>({
        users: 0,
        activeListings: 0,
        openReports: 0,
        completedTrades: 0,
        blockedUsers: 0,
        totalTrades: 0,
        totalMessages: 0,
    });
    const [activity, setActivity] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/analytics', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load analytics');
            const json = await res.json();

            setStats(json.stats);

            const combined: Activity[] = [
                ...(json.activity.users ?? []).map((u: any) => ({
                    id: u.id,
                    type: 'user' as const,
                    label: 'New user registered',
                    sub: u.name ?? 'Unknown',
                    ts: u.created_at,
                })),
                ...(json.activity.listings ?? []).map((l: any) => ({
                    id: l.id,
                    type: 'listing' as const,
                    label: 'New listing posted',
                    sub: l.title,
                    ts: l.created_at,
                })),
                ...(json.activity.reports ?? []).map((r: any) => ({
                    id: r.id,
                    type: 'report' as const,
                    label: 'Report submitted',
                    sub: r.reason?.slice(0, 50) ?? '—',
                    ts: r.created_at,
                })),
                ...(json.activity.trades ?? []).map((t: any) => ({
                    id: t.id,
                    type: 'trade' as const,
                    label: `Trade ${t.status}`,
                    sub: `Trade #${t.id.slice(0, 8).toUpperCase()}`,
                    ts: t.created_at,
                })),
            ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 12);

            setActivity(combined);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('[Analytics]', err);
        }
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    useEffect(() => {
        fetchData().finally(() => setLoading(false));

        // Auto-refresh every 60 seconds
        const interval = setInterval(fetchData, 60_000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const kpis = [
        { label: 'Total Users', value: stats.users, icon: activityIcon.user, color: 'bg-[#1D63ED]/20 text-[#1D63ED]' },
        { label: 'Active Listings', value: stats.activeListings, icon: activityIcon.listing, color: 'bg-purple-500/20 text-purple-400' },
        { label: 'Open Reports', value: stats.openReports, icon: activityIcon.report, color: 'bg-orange-500/20 text-orange-400' },
        { label: 'Completed Trades', value: stats.completedTrades, icon: activityIcon.trade, color: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Blocked Users', value: stats.blockedUsers, icon: activityIcon.user, color: 'bg-red-500/20 text-red-400' },
        { label: 'Total Trades', value: stats.totalTrades, icon: activityIcon.trade, color: 'bg-yellow-500/20 text-yellow-400' },
        {
            label: 'Chat Messages', value: stats.totalMessages, icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            ), color: 'bg-cyan-500/20 text-cyan-400'
        },
    ];

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Real-time platform stats · Last updated {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                    </span>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151D29] border border-white/6 text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-50"
                    >
                        <svg
                            className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            viewBox="0 0 24 24"
                        >
                            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-500">
                    <svg className="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading analytics...
                </div>
            ) : (
                <>
                    {/* KPI Grid */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {kpis.map((k) => (
                            <div key={k.label} className="bg-[#151D29] rounded-2xl p-5 border border-white/5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color}`}>
                                        {k.icon}
                                    </div>
                                </div>
                                <p className="text-gray-500 text-xs mb-1">{k.label}</p>
                                <p className="text-3xl font-bold text-white">{k.value.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>

                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-[#151D29] rounded-2xl p-5 border border-white/5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Trade Success Rate</p>
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-bold text-white">
                                    {stats.totalTrades > 0
                                        ? Math.round((stats.completedTrades / stats.totalTrades) * 100)
                                        : 0}%
                                </p>
                                <p className="text-sm text-gray-500 mb-1">of {stats.totalTrades} total</p>
                            </div>
                            <div className="mt-3 h-2 bg-[#0D0D0D] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                                    style={{ width: `${stats.totalTrades > 0 ? (stats.completedTrades / stats.totalTrades) * 100 : 0}%` }}
                                />
                            </div>
                        </div>

                        <div className="bg-[#151D29] rounded-2xl p-5 border border-white/5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Report Resolution</p>
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-bold text-white">{stats.openReports}</p>
                                <p className="text-sm text-gray-500 mb-1">pending review</p>
                            </div>
                            <div className="mt-3 h-2 bg-[#0D0D0D] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-orange-400 rounded-full transition-all duration-700"
                                    style={{ width: stats.openReports > 0 ? '100%' : '0%' }}
                                />
                            </div>
                        </div>

                        <div className="bg-[#151D29] rounded-2xl p-5 border border-white/5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Platform Health</p>
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-bold text-emerald-400">Good</p>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                All systems operational
                            </div>
                        </div>
                    </div>

                    {/* Activity Feed */}
                    <div className="bg-[#151D29] rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                            <h2 className="font-semibold text-white">Live Activity Feed</h2>
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Updating every 60s
                            </span>
                        </div>
                        <div className="divide-y divide-white/4">
                            {activity.length === 0 ? (
                                <div className="py-16 text-center text-gray-600 text-sm">No activity yet.</div>
                            ) : (
                                activity.map((a) => (
                                    <div key={a.id + a.type} className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/2 transition-colors">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${activityColor[a.type]}`}>
                                            {activityIcon[a.type]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white">{a.label}</p>
                                            <p className="text-xs text-gray-500 truncate">{a.sub}</p>
                                        </div>
                                        <span className="text-xs text-gray-600 flex-shrink-0">{timeAgo(a.ts)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
