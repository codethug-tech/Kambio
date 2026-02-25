'use client';

import { useTransition } from 'react';

interface Props {
    listingId: string;
    isActive: boolean;
    approveFn: (formData: FormData) => Promise<void>;
    hideFn: (formData: FormData) => Promise<void>;
    deleteFn: (formData: FormData) => Promise<void>;
}

export default function ListingActions({ listingId, isActive, approveFn, hideFn, deleteFn }: Props) {
    const [pending, startTransition] = useTransition();

    function submit(action: (fd: FormData) => Promise<void>) {
        const fd = new FormData();
        fd.set('id', listingId);
        startTransition(() => action(fd));
    }

    function handleDelete() {
        if (!confirm('¿Eliminar esta oferta permanentemente? Esta acción no se puede deshacer.')) return;
        submit(deleteFn);
    }

    return (
        <div className="flex items-center gap-1">
            {/* Approve (only when not active) */}
            {!isActive && (
                <button
                    onClick={() => submit(approveFn)}
                    disabled={pending}
                    title="Aprobar"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-40"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </button>
            )}

            {/* Hide / Show toggle */}
            <button
                onClick={() => submit(isActive ? hideFn : approveFn)}
                disabled={pending}
                title={isActive ? 'Ocultar' : 'Mostrar'}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/8 transition-colors disabled:opacity-40"
            >
                {isActive ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                )}
            </button>

            {/* Delete */}
            <button
                onClick={handleDelete}
                disabled={pending}
                title="Eliminar"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
            </button>
        </div>
    );
}
