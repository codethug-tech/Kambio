'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Types ───────────────────────────────────────────────────────────────────
type Category = {
    id: string;
    name: string;
    subtitle: string;
    type: 'barter' | 'fiat_swap' | 'service';
    icon: string;
    display_order: number;
    is_active: boolean;
};

type Location = {
    id: string;
    name: string;
    level: 'state' | 'municipality' | 'neighborhood';
    parent_id: string | null;
    is_active: boolean;
    children?: Location[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const typeMeta: Record<string, { label: string; cls: string }> = {
    barter: { label: 'Barter', cls: 'bg-purple-500/20 text-purple-300' },
    fiat_swap: { label: 'Fiat Swap', cls: 'bg-emerald-500/20 text-emerald-300' },
    service: { label: 'Service', cls: 'bg-orange-500/20 text-orange-300' },
};

function buildTree(flat: Location[]): Location[] {
    const map: Record<string, Location> = {};
    flat.forEach(l => { map[l.id] = { ...l, children: [] }; });
    const roots: Location[] = [];
    flat.forEach(l => {
        if (l.parent_id && map[l.parent_id]) {
            map[l.parent_id].children!.push(map[l.id]);
        } else if (!l.parent_id) {
            roots.push(map[l.id]);
        }
    });
    return roots;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SettingsPage() {
    const [tab, setTab] = useState<'categories' | 'locations' | 'notifications'>('categories');
    const [categories, setCategories] = useState<Category[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState<Category | null>(null);
    const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // ── Form state ───────────────────────────────────────────────────────────
    const [form, setForm] = useState({ name: '', subtitle: '', type: 'barter', icon: '📦' });

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchCategories = useCallback(async () => {
        const { data } = await supabase.from('categories').select('*').order('display_order');
        setCategories(data ?? []);
    }, []);

    const fetchLocations = useCallback(async () => {
        const { data } = await supabase.from('locations').select('*').order('name');
        setLocations(data ?? []);
    }, []);

    useEffect(() => {
        Promise.all([fetchCategories(), fetchLocations()]).finally(() => setLoading(false));

        // Realtime subscriptions
        const catChannel = supabase
            .channel('categories-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchCategories)
            .subscribe();

        const locChannel = supabase
            .channel('locations-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, fetchLocations)
            .subscribe();

        return () => {
            supabase.removeChannel(catChannel);
            supabase.removeChannel(locChannel);
        };
    }, [fetchCategories, fetchLocations]);

    // ── Category actions ────────────────────────────────────────────────────
    const toggleCategory = async (id: string, current: boolean) => {
        await supabase.from('categories').update({ is_active: !current }).eq('id', id);
        showToast(`Category ${!current ? 'activated' : 'deactivated'}`);
    };

    const deleteCategory = async (id: string) => {
        if (!confirm('Delete this category?')) return;
        await supabase.from('categories').delete().eq('id', id);
        showToast('Category deleted');
    };

    const openModal = (cat?: Category) => {
        if (cat) {
            setEditItem(cat);
            setForm({ name: cat.name, subtitle: cat.subtitle, type: cat.type, icon: cat.icon });
        } else {
            setEditItem(null);
            setForm({ name: '', subtitle: '', type: 'barter', icon: '📦' });
        }
        setShowModal(true);
    };

    const saveCategory = async () => {
        if (!form.name.trim()) return;
        if (editItem) {
            await supabase.from('categories').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editItem.id);
            showToast('Category updated');
        } else {
            const maxOrder = Math.max(0, ...categories.map(c => c.display_order));
            await supabase.from('categories').insert({ ...form, display_order: maxOrder + 1 });
            showToast('Category created');
        }
        setShowModal(false);
    };

    // ── Location actions ────────────────────────────────────────────────────
    const addLocation = async (name: string, level: Location['level'], parentId: string | null) => {
        if (!name.trim()) return;
        await supabase.from('locations').insert({ name, level, parent_id: parentId });
        showToast('Location added');
    };

    const locationTree = buildTree(locations);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-8 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl transition-all
                    ${toast.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">System Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage trade categories, operational zones, and location hierarchy.</p>
                </div>
                {tab === 'categories' && (
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#1D63ED] hover:bg-[#1855CC] text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Add New
                    </button>
                )}
                {tab === 'locations' && (
                    <AddLocationModal onAdd={addLocation} />
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-white/6 mb-6">
                {(['categories', 'locations', 'notifications'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
                            ${tab === t ? 'text-[#1D63ED] border-[#1D63ED]' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-500">
                    <svg className="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                </div>
            ) : (
                <>
                    {/* ── CATEGORIES TAB ─────────────────────────────────────────────── */}
                    {tab === 'categories' && (
                        <div>
                            {/* Search + Filters */}
                            <div className="flex gap-3 mb-4">
                                <div className="flex-1 flex items-center gap-2 bg-[#151D29] border border-white/6 rounded-xl px-4 py-2.5">
                                    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                    <input type="text" placeholder="Search categories by name..." className="bg-transparent text-sm text-white placeholder-gray-600 outline-none w-full" />
                                </div>
                                <select className="bg-[#151D29] border border-white/6 rounded-xl px-4 py-2.5 text-sm text-gray-300 outline-none">
                                    <option>All Types</option>
                                    <option value="barter">Barter</option>
                                    <option value="fiat_swap">Fiat Swap</option>
                                    <option value="service">Service</option>
                                </select>
                                <select className="bg-[#151D29] border border-white/6 rounded-xl px-4 py-2.5 text-sm text-gray-300 outline-none">
                                    <option>Active Only</option>
                                    <option>All Statuses</option>
                                    <option>Inactive Only</option>
                                </select>
                            </div>

                            {/* Table */}
                            <div className="bg-[#151D29] rounded-2xl border border-white/5 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/5 text-[11px] text-gray-500 uppercase tracking-wider">
                                            <th className="text-left px-6 py-3 w-12">Order</th>
                                            <th className="text-left px-6 py-3">Category Name</th>
                                            <th className="text-left px-6 py-3">Type</th>
                                            <th className="text-left px-6 py-3">Status</th>
                                            <th className="text-right px-6 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/4">
                                        {categories.map((cat) => (
                                            <tr key={cat.id} className="hover:bg-white/2 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1 text-gray-600">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                                                            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                                                            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                                                        </svg>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: '#1A1A2E' }}>
                                                            {cat.icon}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-white">{cat.name}</p>
                                                            <p className="text-xs text-gray-500">{cat.subtitle}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${typeMeta[cat.type]?.cls ?? 'bg-gray-700 text-gray-300'}`}>
                                                        {typeMeta[cat.type]?.label ?? cat.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => toggleCategory(cat.id, cat.is_active)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                                                            ${cat.is_active ? 'bg-[#1D63ED]' : 'bg-gray-700'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                                                            ${cat.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openModal(cat)}
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => deleteCategory(cat.id)}
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {categories.length === 0 && (
                                    <div className="py-16 text-center text-gray-600 text-sm">No categories yet. Click &quot;Add New&quot; to create one.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── LOCATIONS TAB ──────────────────────────────────────────────── */}
                    {tab === 'locations' && (
                        <div>
                            <h2 className="font-semibold text-white mb-4">Recent Location Updates</h2>
                            <div className="bg-[#151D29] rounded-2xl border border-white/5 p-4 space-y-3">
                                {locationTree.map(state => (
                                    <StateRow
                                        key={state.id}
                                        state={state}
                                        expanded={expandedStates.has(state.id)}
                                        onToggle={() => setExpandedStates(prev => {
                                            const next = new Set(prev);
                                            next.has(state.id) ? next.delete(state.id) : next.add(state.id);
                                            return next;
                                        })}
                                        onAddSub={(parentId) => {
                                            const name = prompt('Municipality name:');
                                            if (name) addLocation(name, 'municipality', parentId);
                                        }}
                                        onEdit={(loc) => {
                                            const name = prompt('New name:', loc.name);
                                            if (name) supabase.from('locations').update({ name }).eq('id', loc.id);
                                        }}
                                    />
                                ))}
                                {locationTree.length === 0 && (
                                    <p className="text-center text-gray-600 text-sm py-8">No locations yet.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── NOTIFICATIONS TAB ──────────────────────────────────────────── */}
                    {tab === 'notifications' && (
                        <NotificationsTab />
                    )}
                </>
            )}

            {/* ── MODAL ───────────────────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative z-50 bg-[#151D29] border border-white/8 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-6">{editItem ? 'Edit Category' : 'New Category'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Icon</label>
                                <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                                    className="w-20 bg-[#0D0D0D] border border-white/8 rounded-xl px-3 py-2.5 text-2xl outline-none text-center"
                                    placeholder="📦" maxLength={2} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Name</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#1D63ED]/60"
                                    placeholder="Electronics" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Subtitle</label>
                                <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                                    className="w-full bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#1D63ED]/60"
                                    placeholder="Laptops, Phones, Gadgets" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Type</label>
                                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                                    className="w-full bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white outline-none">
                                    <option value="barter">Barter</option>
                                    <option value="fiat_swap">Fiat Swap</option>
                                    <option value="service">Service</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-white/8 text-gray-400 hover:text-white text-sm font-medium transition-colors">
                                Cancel
                            </button>
                            <button onClick={saveCategory}
                                className="flex-1 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-[#1855CC] text-white text-sm font-semibold transition-colors">
                                {editItem ? 'Save Changes' : 'Create Category'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Location State Row ────────────────────────────────────────────────────────
function StateRow({
    state, expanded, onToggle, onAddSub, onEdit
}: {
    state: Location;
    expanded: boolean;
    onToggle: () => void;
    onAddSub: (id: string) => void;
    onEdit: (loc: Location) => void;
}) {
    const munis = state.children ?? [];
    return (
        <div className="bg-[#0D0D0D] rounded-xl overflow-hidden border border-white/5">
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/2" onClick={onToggle}>
                <div className="flex items-center gap-3">
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
                    <span className="font-semibold text-white">{state.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1D63ED]/20 text-[#4D8EFF]">State</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">{munis.length} Municipalities</span>
                    <button
                        onClick={e => { e.stopPropagation(); onAddSub(state.id); }}
                        className="text-xs text-[#1D63ED] hover:text-blue-400 font-semibold transition-colors"
                    >
                        Add Sub-location
                    </button>
                </div>
            </div>
            {expanded && munis.length > 0 && (
                <div className="border-t border-white/5 divide-y divide-white/4">
                    {munis.map(m => (
                        <div key={m.id} className="flex items-center justify-between px-6 py-2.5 hover:bg-white/2">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                                {m.name}
                            </div>
                            <button onClick={() => onEdit(m)} className="text-xs text-gray-500 hover:text-white transition-colors">Edit</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Add Location Modal Button ─────────────────────────────────────────────────
function AddLocationModal({ onAdd }: { onAdd: (name: string, level: Location['level'], parentId: string | null) => void }) {
    const [show, setShow] = useState(false);
    const [name, setName] = useState('');
    const [level, setLevel] = useState<Location['level']>('state');

    return (
        <>
            <button onClick={() => setShow(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1D63ED] hover:bg-[#1855CC] text-white text-sm font-semibold rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add Location
            </button>
            {show && (
                <div className="fixed inset-0 z-40 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShow(false)} />
                    <div className="relative z-50 bg-[#151D29] border border-white/8 rounded-2xl p-6 w-80 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-4">Add State</h3>
                        <input value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-[#0D0D0D] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white outline-none mb-4"
                            placeholder="State name..." />
                        <div className="flex gap-3">
                            <button onClick={() => setShow(false)} className="flex-1 py-2.5 rounded-xl border border-white/8 text-gray-400 text-sm">Cancel</button>
                            <button onClick={() => { onAdd(name, level, null); setShow(false); setName(''); }}
                                className="flex-1 py-2.5 rounded-xl bg-[#1D63ED] text-white text-sm font-semibold">Add</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────
function NotificationsTab() {
    const [settings, setSettings] = useState({
        newUser: true,
        newListing: false,
        newReport: true,
        tradeCompleted: true,
        userBlocked: false,
        dailySummary: true,
        weeklyReport: false,
    });

    const toggle = (key: keyof typeof settings) => setSettings(s => ({ ...s, [key]: !s[key] }));

    const rows: { key: keyof typeof settings; label: string; desc: string }[] = [
        { key: 'newUser', label: 'New User Registration', desc: 'Notify when a new user signs up' },
        { key: 'newListing', label: 'New Listing Posted', desc: 'Notify on every new listing' },
        { key: 'newReport', label: 'New Report Submitted', desc: 'Alert on new user/listing reports' },
        { key: 'tradeCompleted', label: 'Trade Completed', desc: 'Notify when trades are marked complete' },
        { key: 'userBlocked', label: 'User Blocked', desc: 'Confirm when a user account is blocked' },
        { key: 'dailySummary', label: 'Daily Summary Email', desc: 'Receive daily platform stats at 8am' },
        { key: 'weeklyReport', label: 'Weekly Report', desc: 'Receive a weekly performance report' },
    ];

    return (
        <div className="bg-[#151D29] rounded-2xl border border-white/5 divide-y divide-white/5">
            {rows.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between px-6 py-4">
                    <div>
                        <p className="text-sm font-medium text-white">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                    <button
                        onClick={() => toggle(key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                            ${settings[key] ? 'bg-[#1D63ED]' : 'bg-gray-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                            ${settings[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            ))}
        </div>
    );
}
