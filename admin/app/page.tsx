'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError('Contraseña incorrecta');
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundColor: '#0D0D0D',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}
    >
      <div className="w-full max-w-sm px-4">
        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4">
              <span style={{ fontSize: 48, fontWeight: 900, color: '#00E676', lineHeight: 1 }}>K</span>
              <span style={{ fontSize: 48, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>ambio</span>
            </div>
            <p className="text-sm" style={{ color: '#9E9E9E' }}>Admin Panel</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: '#E0E0E0' }}
              >
                Contraseña
              </label>
              <input
                type="password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                style={{
                  backgroundColor: '#242424',
                  border: '1.5px solid transparent',
                  caretColor: '#00E676',
                }}
                onFocus={e => (e.target.style.border = '1.5px solid #00E676')}
                onBlur={e => (e.target.style.border = '1.5px solid transparent')}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#FF5252' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#00E676',
                color: '#000000',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
