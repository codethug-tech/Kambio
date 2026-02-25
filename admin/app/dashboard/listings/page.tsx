import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import ListingActions from './listing-actions';

async function approveListing(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await supabaseAdmin.from('listings').update({ status: 'active' }).eq('id', id);
    revalidatePath('/dashboard/listings');
}

async function hideListing(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await supabaseAdmin.from('listings').update({ status: 'hidden' }).eq('id', id);
    revalidatePath('/dashboard/listings');
}

async function deleteListing(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    // Delete photos first (storage + db rows)
    const { data: photos } = await supabaseAdmin
        .from('listing_photos')
        .select('url')
        .eq('listing_id', id);
    if (photos && photos.length > 0) {
        const paths = photos.map((p: any) => {
            const url = p.url as string;
            // Extract storage path from URL
            const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
            return match ? match[1] : null;
        }).filter(Boolean) as string[];
        if (paths.length > 0) {
            await supabaseAdmin.storage.from('listing-photos').remove(paths);
        }
    }
    await supabaseAdmin.from('listings').delete().eq('id', id);
    revalidatePath('/dashboard/listings');
}

function initials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'ahora';
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

const typeStyle: Record<string, { label: string; cls: string }> = {
    cambio: { label: 'Cambio Bs/USD', cls: 'bg-[#1D63ED]/20 text-[#4D8EFF]' },
    trueque: { label: 'Trueque', cls: 'bg-purple-500/20 text-purple-400' },
    servicio: { label: 'Servicio', cls: 'bg-orange-500/20 text-orange-400' },
};

export default async function ListingsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; page?: string }>;
}) {
    const params = await searchParams;
    const q = params.q ?? '';
    const page = parseInt(params.page ?? '1', 10);
    const perPage = 20;

    let query = supabaseAdmin
        .from('listings')
        .select('id, title, type, category, status, city, state, created_at, users(name), listing_photos(url)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

    if (q) query = query.ilike('title', `%${q}%`);

    const { data: listings = [], count = 0 } = await query;
    const totalPages = Math.ceil((count ?? 0) / perPage);

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Moderación de Ofertas</h1>
                <p className="text-sm text-gray-500 mt-1">Revisa, oculta, aprueba o elimina las ofertas del marketplace.</p>
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 mb-6">
                <form method="GET" className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                        name="q"
                        defaultValue={q}
                        placeholder="Buscar título, usuario o ID..."
                        className="bg-[#151D29] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#1D63ED]/50 w-80 transition-colors"
                    />
                </form>
                <span className="text-xs text-gray-500">{count ?? 0} ofertas en total</span>
            </div>

            {/* Table */}
            <div className="bg-[#151D29] rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Oferta</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Usuario</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Tipo</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Fecha</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Estado</th>
                            <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 tracking-wider uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                        {(listings ?? []).map((l: any) => {
                            const user = l.users as any;
                            const photos = l.listing_photos as any[];
                            const thumb = photos?.[0]?.url;
                            const t = typeStyle[l.type] ?? { label: l.type, cls: 'bg-gray-700/50 text-gray-400' };
                            const isActive = l.status === 'active';
                            const isHidden = l.status === 'hidden';
                            return (
                                <tr key={l.id} className="hover:bg-white/2 transition-colors">
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
                                                <p className="font-medium text-white truncate max-w-[160px]">{l.title}</p>
                                                <p className="text-[11px] text-gray-500">ID: #{l.id.slice(0, 6).toUpperCase()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-[#1D63ED]/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-[10px] font-bold text-[#4D8EFF]">{initials(user?.name)}</span>
                                            </div>
                                            <span className="text-gray-300">{user?.name ?? '—'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${t.cls}`}>{t.label}</span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">{timeAgo(l.created_at)}</td>
                                    <td className="px-6 py-4">
                                        {isActive
                                            ? <span className="bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-semibold">Activo</span>
                                            : isHidden
                                                ? <span className="bg-yellow-500/15 text-yellow-400 px-2.5 py-1 rounded-lg text-xs font-semibold">Oculto</span>
                                                : <span className="bg-red-500/15 text-red-400 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize">{l.status}</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4">
                                        <ListingActions
                                            listingId={l.id}
                                            isActive={isActive}
                                            approveFn={approveListing}
                                            hideFn={hideListing}
                                            deleteFn={deleteListing}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {(listings ?? []).length === 0 && (
                    <div className="text-center py-16 text-gray-600">
                        <p className="text-sm">No se encontraron ofertas</p>
                    </div>
                )}
            </div>

            {/* Pagination */}
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
