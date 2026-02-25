import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';

async function getRecentReports() {
    const { data } = await supabaseAdmin
        .from('reports')
        .select('id, reason, target_type, target_id, created_at, reporter:reporter_id(name)')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(5);
    return data ?? [];
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const reasonBadge: Record<string, { label: string; cls: string }> = {
    scam: { label: 'SCAM ATTEMPT', cls: 'text-red-400 bg-red-400/10' },
    spam: { label: 'SPAM', cls: 'text-orange-400 bg-orange-400/10' },
    prohibited: { label: 'PROHIBITED ITEM', cls: 'text-orange-300 bg-orange-300/10' },
    fake: { label: 'FAKE PROFILE', cls: 'text-blue-400 bg-blue-400/10' },
    other: { label: 'REPORT', cls: 'text-gray-400 bg-gray-400/10' },
};

function getBadge(reason: string) {
    const key = Object.keys(reasonBadge).find(k => reason.toLowerCase().includes(k)) ?? 'other';
    return reasonBadge[key];
}

function initials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    if (!cookieStore.get('kambio_admin')) redirect('/');

    const reports = await getRecentReports();

    const navLinks = [
        {
            href: '/dashboard', label: 'Dashboard',
            icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
        },
        {
            href: '/dashboard/users', label: 'User Management',
            icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        },
        {
            href: '/dashboard/listings', label: 'Listing Moderation',
            icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>
        },
        {
            href: '/dashboard/reports', label: 'Reported Content',
            icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
        },
        {
            href: '/dashboard/analytics', label: 'Analytics',
            icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
        },
        {
            href: '/dashboard/settings', label: 'System Settings',
            icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        },
    ];

    return (
        <div className="flex min-h-screen bg-[#0B111A] text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Left Sidebar */}
            <aside className="w-[220px] bg-[#05090E] flex flex-col fixed h-full z-20 border-r border-white/5">
                {/* Logo */}
                <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
                    <div className="w-9 h-9 rounded-lg bg-[#1D63ED] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-lg">K</span>
                    </div>
                    <div>
                        <p className="font-bold text-sm text-white leading-none">Kambio</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Admin Console</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    {navLinks.map((l, i) => (
                        <Link key={i} href={l.href}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all group">
                            <span className="group-hover:text-white transition-colors">{l.icon}</span>
                            <span>{l.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* User Footer */}
                <div className="px-3 py-4 border-t border-white/5">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-[#1D63ED]/30 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-[#1D63ED]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">Admin</p>
                            <p className="text-[10px] text-gray-500">Super Admin</p>
                        </div>
                        <form action="/api/admin-logout" method="POST">
                            <button title="Logout" className="text-gray-500 hover:text-red-400 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                            </button>
                        </form>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-[220px] mr-[300px] flex-1 min-h-screen">
                {children}
            </main>

            {/* Right Reports Panel */}
            <aside className="w-[300px] bg-[#05090E] fixed right-0 top-0 h-full border-l border-white/5 flex flex-col z-20">
                <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
                    <h3 className="font-semibold text-sm text-white">Recent Reports</h3>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                    {reports.length === 0 && (
                        <p className="text-gray-500 text-xs text-center py-10">No pending reports 🎉</p>
                    )}
                    {(reports as any[]).map((r) => {
                        const badge = getBadge(r.reason ?? '');
                        const reporterName = (r.reporter as any)?.name;
                        return (
                            <div key={r.id} className="px-5 py-4 hover:bg-white/3 transition-colors">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${badge.cls}`}>
                                        {badge.label}
                                    </span>
                                    <span className="text-[10px] text-gray-500 flex-shrink-0">{timeAgo(r.created_at)}</span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed mb-3 line-clamp-2">{r.reason}</p>
                                <p className="text-[10px] text-gray-500 mb-2">
                                    Tipo: <span className="capitalize">{r.target_type}</span>
                                </p>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-[#151D29] flex items-center justify-center">
                                            <span className="text-[8px] text-gray-400 font-semibold">{initials(reporterName)}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-500">Por: {reporterName ?? '—'}</span>
                                    </div>
                                    <Link href="/dashboard/reports">
                                        <svg className="w-3.5 h-3.5 text-gray-600 hover:text-[#1D63ED] transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {reports.length > 0 && (
                    <div className="px-5 py-4 border-t border-white/5">
                        <Link href="/dashboard/reports" className="text-sm text-[#1D63ED] hover:text-blue-400 transition-colors font-medium">
                            View All Reports →
                        </Link>
                    </div>
                )}
            </aside>
        </div>
    );
}
