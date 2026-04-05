/**
 * BCV exchange rate fetcher — shared module.
 *
 * Verified live endpoints (2026-04-05):
 *   • ve.dolarapi.com/v1/dolares/oficial → { promedio: 473.9176, ... }  (Bs/USD)
 *   • open.er-api.com/v6/latest/USD     → { rates: { VES: 474.06, EUR: 0.8675 } }
 *
 * Strategy (3 sources, first success wins):
 *   1. open.er-api.com   — gives VES + EUR in one call, most reliable
 *   2. dolarapi /dolares/oficial — USD only, EUR calculated from ECB endpoint
 *   3. dolarapi /dolares  — full array fallback
 *
 * Works on Node ≥ 18 (native fetch) and Node 16/17 (node-fetch fallback).
 */

let _fetch;
async function getFetch() {
    if (_fetch) return _fetch;
    if (typeof globalThis.fetch === 'function') {
        _fetch = globalThis.fetch.bind(globalThis);
    } else {
        const mod = await import('node-fetch');
        _fetch = mod.default;
    }
    return _fetch;
}

const supabase = require('./supabase');

function round(n) {
    return Math.round(Number(n) * 100) / 100;
}

async function get(url, ms = 10000) {
    const fn = await getFetch();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fn(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fetches live BCV-compatible rates.
 * Returns { USD: number, EUR: number } — Bs per 1 unit.
 * Throws if all sources fail.
 */
async function fetchBcvRates() {
    const errors = [];

    // ── Source 1: open.er-api.com (VES + EUR in one call) ──────────────────
    try {
        const j = await get('https://open.er-api.com/v6/latest/USD');
        // j.rates.VES  = Bs per 1 USD
        // j.rates.EUR  = EUR per 1 USD  →  Bs/EUR = VES / EUR
        const usdVes = Number(j?.rates?.VES);
        const eurPerUsd = Number(j?.rates?.EUR);
        if (usdVes > 0 && eurPerUsd > 0) {
            return {
                USD: round(usdVes),
                EUR: round(usdVes / eurPerUsd),
            };
        }
        errors.push(`er-api: VES=${usdVes} EUR=${eurPerUsd}`);
    } catch (e) {
        errors.push(`er-api: ${e.message}`);
    }

    // ── Source 2: dolarapi /dolares/oficial  (USD) + /latest/EUR (EUR) ─────
    try {
        const [jUsd, jEur] = await Promise.all([
            get('https://ve.dolarapi.com/v1/dolares/oficial'),
            get('https://open.er-api.com/v6/latest/EUR', 8000),
        ]);
        // jUsd.promedio = Bs per 1 USD (official BCV rate)
        // jEur.rates.USD = USD per 1 EUR  →  Bs/EUR = Bs/USD * USD/EUR
        const usd = Number(jUsd?.promedio ?? jUsd?.venta ?? 0);
        const eurToUsd = Number(jEur?.rates?.USD ?? 0); // USD per 1 EUR
        if (usd > 0 && eurToUsd > 0) {
            return {
                USD: round(usd),
                EUR: round(usd * eurToUsd),
            };
        }
        if (usd > 0) {
            errors.push(`source2: got USD=${usd} but no EUR rate`);
        } else {
            errors.push(`source2: dolarapi USD=${usd}`);
        }
    } catch (e) {
        errors.push(`source2: ${e.message}`);
    }

    // ── Source 3: dolarapi official endpoints (both USD + EUR directly) ──────
    // Verified live 2026-04-05:
    //   /v1/dolares/oficial → { moneda:"USD", fuente:"oficial", promedio: 473.9176, ... }
    //   /v1/euros          → { moneda:"EUR", fuente:"oficial", promedio: 545.94833602, ... }
    //   compra + venta are null; use promedio only.
    try {
        const [jUsd, jEur] = await Promise.all([
            get('https://ve.dolarapi.com/v1/dolares/oficial'),
            get('https://ve.dolarapi.com/v1/euros'),
        ]);
        // promedio is the only populated field from BCV
        const usd = Number(jUsd?.promedio ?? 0);
        const eur = Number(jEur?.promedio ?? 0);
        if (usd > 0 && eur > 0) return { USD: round(usd), EUR: round(eur) };
        if (usd > 0) errors.push(`source3: USD=${usd} but EUR=${eur}`);
        else errors.push(`source3: dolarapi returned USD=${usd}`);
    } catch (e) {
        errors.push(`source3: ${e.message}`);
    }

    throw new Error(`All BCV sources failed:\n  ${errors.join('\n  ')}`);
}

/**
 * Fetches rates and upserts them into the exchange_rates table.
 * Returns { USD, EUR } on success, or null if all sources failed.
 */
async function refreshAndStore() {
    try {
        const rates = await fetchBcvRates();
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('exchange_rates')
            .upsert(
                [
                    { currency: 'USD', rate: rates.USD, source: 'BCV', updated_at: now },
                    { currency: 'EUR', rate: rates.EUR, source: 'BCV', updated_at: now },
                ],
                { onConflict: 'currency' }
            );
        if (error) throw new Error(error.message);
        console.log(`[BCV] ✓ USD: ${rates.USD} Bs | EUR: ${rates.EUR} Bs  (${now})`);
        return rates;
    } catch (e) {
        console.error(`[BCV] ✗ Refresh failed: ${e.message}`);
        return null;
    }
}

module.exports = { fetchBcvRates, refreshAndStore };
