import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

async function blockUser(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const block = formData.get('action') === 'block';
    await supabaseAdmin.from('users').update({ is_blocked: block }).eq('id', id);
    revalidatePath('/dashboard/users');
}

function initials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; page?: string }>;
}) {
    const params = await searchParams;
    const q = params.q ?? '';
    const page = parseInt(params.page ?? '1', 10);
    const perPage = 20;

    let query = supabaseAdmin
        .from('users')
        .select('id, name, email, city, state, is_blocked, created_at, trades_count, rating', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);

    const { data: users = [], count = 0 } = await query;
    const totalPages = Math.ceil((count ?? 0) / perPage);

    return (
        <div className="p-8">
            {/* Encabezado */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Gestión de Usuarios</h1>
                <p className="text-sm text-gray-500 mt-1">Administra, busca y modera todos los usuarios registrados.</p>
            </div>

            {/* Búsqueda */}
            <div className="flex items-center gap-3 mb-6">
                <form method="GET" className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                        name="q"
                        defaultValue={q}
                        placeholder="Buscar por nombre o correo..."
                        className="bg-[#151D29] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#1D63ED]/50 w-80 transition-colors"
                    />
                </form>
                <span className="text-xs text-gray-500">{count ?? 0} usuarios en total</span>
            </div>

            {/* Tabla */}
            <div className="bg-[#151D29] rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Usuario</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Correo</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Ubicación</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Calificación</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Trueques</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Estado</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                        {(users ?? []).map((u: any) => (
                            <tr key={u.id} className="hover:bg-white/2 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[#1D63ED]/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-[#4D8EFF]">{initials(u.name)}</span>
                                        </div>
                                        <span className="font-medium text-white">{u.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-400">{u.email}</td>
                                <td className="px-6 py-4 text-gray-400">{[u.city, u.state].filter(Boolean).join(', ') || '—'}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                        <span className="text-gray-300 text-sm">{(u.rating as number)?.toFixed(1) ?? '—'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-300">{u.trades_count ?? 0}</td>
                                <td className="px-6 py-4">
                                    {u.is_blocked
                                        ? <span className="bg-red-500/15 text-red-400 px-2.5 py-1 rounded-lg text-xs font-semibold">Bloqueado</span>
                                        : <span className="bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-semibold">Activo</span>}
                                </td>
                                <td className="px-6 py-4">
                                    <form action={blockUser}>
                                        <input type="hidden" name="id" value={u.id} />
                                        <input type="hidden" name="action" value={u.is_blocked ? 'unblock' : 'block'} />
                                        <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${u.is_blocked
                                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                            }`}>
                                            {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {(users ?? []).length === 0 && (
                    <div className="text-center py-16 text-gray-600">
                        <p className="text-sm">No se encontraron usuarios</p>
                    </div>
                )}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div className="flex gap-2 mt-4 justify-end">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <a key={p} href={`?q=${q}&page=${p}`}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${p === page
                                ? 'bg-[#1D63ED] text-white'
                                : 'bg-[#151D29] text-gray-400 hover:bg-[#1A2338] border border-white/5'}`}>
                            {p}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
