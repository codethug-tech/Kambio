import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

async function resolveReport(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await supabaseAdmin.from('reports').update({ resolved: true }).eq('id', id);
    revalidatePath('/dashboard/reports');
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

function initials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

const reasonBadge: Record<string, { label: string; cls: string }> = {
    scam: { label: 'SCAM', cls: 'text-red-400 bg-red-400/10' },
    spam: { label: 'SPAM', cls: 'text-orange-400 bg-orange-400/10' },
    prohibited: { label: 'PROHIBIDO', cls: 'text-orange-300 bg-orange-300/10' },
    fake: { label: 'FALSO', cls: 'text-blue-400 bg-blue-400/10' },
    other: { label: 'REPORTE', cls: 'text-gray-400 bg-gray-400/10' },
};

function getBadge(reason: string) {
    const key = Object.keys(reasonBadge).find(k => reason.toLowerCase().includes(k)) ?? 'other';
    return reasonBadge[key];
}

export default async function ReportsPage() {
    // Fetch reports with only the columns that actually exist
    const { data: reports = [], error } = await supabaseAdmin
        .from('reports')
        .select('id, reason, target_type, target_id, resolved, created_at, reporter:reporter_id(id, name)')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('[Reports] fetch error:', error.message);
    }

    // For user-targeted reports, fetch user names in a second query
    const userTargetIds = (reports ?? [])
        .filter((r: any) => r.target_type === 'user' && r.target_id)
        .map((r: any) => r.target_id as string);

    const listingTargetIds = (reports ?? [])
        .filter((r: any) => r.target_type === 'listing' && r.target_id)
        .map((r: any) => r.target_id as string);

    const [usersRes, listingsRes] = await Promise.all([
        userTargetIds.length > 0
            ? supabaseAdmin.from('users').select('id, name').in('id', userTargetIds)
            : Promise.resolve({ data: [] }),
        listingTargetIds.length > 0
            ? supabaseAdmin.from('listings').select('id, title').in('id', listingTargetIds)
            : Promise.resolve({ data: [] }),
    ]);

    const userMap = Object.fromEntries(
        (usersRes.data ?? []).map((u: any) => [u.id, u.name])
    );
    const listingMap = Object.fromEntries(
        (listingsRes.data ?? []).map((l: any) => [l.id, l.title])
    );

    function getTarget(r: any): string {
        if (r.target_type === 'user') return userMap[r.target_id] ?? r.target_id ?? '—';
        if (r.target_type === 'listing') return listingMap[r.target_id] ?? r.target_id ?? '—';
        return r.target_id ?? '—';
    }

    const open = (reports ?? []).filter((r: any) => !r.resolved);
    const resolved = (reports ?? []).filter((r: any) => r.resolved);

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Contenido Reportado</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        <span className="text-red-400 font-semibold">{open.length}</span> reporte{open.length !== 1 ? 's' : ''} pendiente{open.length !== 1 ? 's' : ''}.
                    </p>
                </div>
            </div>

            {/* Open Reports */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <h2 className="font-semibold text-white text-sm">Abiertos</h2>
                    <span className="bg-red-500/15 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">{open.length}</span>
                </div>

                <div className="bg-[#151D29] rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Tipo</th>
                                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Motivo</th>
                                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Objetivo</th>
                                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Reportado por</th>
                                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Fecha</th>
                                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/4">
                            {open.map((r: any) => {
                                const badge = getBadge(r.reason ?? '');
                                const reporterName = (r.reporter as any)?.name;
                                const target = getTarget(r);
                                return (
                                    <tr key={r.id} className="hover:bg-white/2 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded-lg ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-gray-300 text-sm max-w-[220px] truncate">{r.reason}</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">
                                            <span className="flex items-center gap-1.5">
                                                {r.target_type === 'user'
                                                    ? <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                    : <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
                                                }
                                                <span className="truncate max-w-[120px]">{target}</span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-[#151D29] border border-white/10 flex items-center justify-center">
                                                    <span className="text-[9px] font-semibold text-gray-400">{initials(reporterName)}</span>
                                                </div>
                                                <span className="text-gray-400 text-sm">{reporterName ?? '—'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">{timeAgo(r.created_at)}</td>
                                        <td className="px-6 py-4">
                                            <form action={resolveReport}>
                                                <input type="hidden" name="id" value={r.id} />
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                                                    Resolver
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                );
                            })}
                            {open.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-gray-600">
                                        <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                        <p className="text-sm">No hay reportes abiertos 🎉</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Resolved Reports */}
            {resolved.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <h2 className="font-semibold text-gray-500 text-sm">Resueltos</h2>
                        <span className="bg-white/5 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">{resolved.length}</span>
                    </div>
                    <div className="bg-[#151D29] rounded-2xl border border-white/5 overflow-hidden opacity-60">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-600 tracking-wider uppercase">Tipo</th>
                                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-600 tracking-wider uppercase">Motivo</th>
                                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-600 tracking-wider uppercase">Objetivo</th>
                                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-600 tracking-wider uppercase">Reportado por</th>
                                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-600 tracking-wider uppercase">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/4">
                                {resolved.slice(0, 10).map((r: any) => {
                                    const badge = getBadge(r.reason ?? '');
                                    const reporterName = (r.reporter as any)?.name;
                                    return (
                                        <tr key={r.id}>
                                            <td className="px-6 py-3">
                                                <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-lg ${badge.cls}`}>{badge.label}</span>
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 truncate max-w-[220px]">{r.reason}</td>
                                            <td className="px-6 py-3 text-gray-600 truncate max-w-[120px]">{getTarget(r)}</td>
                                            <td className="px-6 py-3 text-gray-600">{reporterName ?? '—'}</td>
                                            <td className="px-6 py-3 text-gray-600">{timeAgo(r.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
