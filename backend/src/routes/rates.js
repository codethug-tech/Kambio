const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

/**
 * GET /api/rates
 * Returns current BCV exchange rates from the DB.
 * The DB is updated by the Supabase Edge Function or a cron call.
 */
router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('exchange_rates')
        .select('currency, rate, source, updated_at')
        .order('currency');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

/**
 * POST /api/rates/refresh
 * Triggers a live fetch from BCV-compatible sources and updates the DB.
 * Called manually or by a cron job (e.g., every 6 hours).
 */
router.post('/refresh', async (req, res) => {
    try {
        const rates = await fetchBcvRates();
        const now = new Date().toISOString();

        const { error } = await supabase
            .from('exchange_rates')
            .upsert([
                { currency: 'USD', rate: rates.USD, source: 'BCV', updated_at: now },
                { currency: 'EUR', rate: rates.EUR, source: 'BCV', updated_at: now },
            ], { onConflict: 'currency' });

        if (error) return res.status(500).json({ error: error.message });
        res.json({ ok: true, rates, updated_at: now });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchBcvRates() {
    const errors = [];

    // Source 1: open.er-api.com (free, reliable, no key needed)
    try {
        const r = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', 8000);
        if (r.ok) {
            const j = await r.json();
            const usdVes = j?.rates?.VES;
            const eurRate = j?.rates?.EUR; // EUR per 1 USD
            if (usdVes && eurRate) {
                const eurVes = usdVes / eurRate; // how many Bs per 1 EUR
                return {
                    USD: Math.round(usdVes * 100) / 100,
                    EUR: Math.round(eurVes * 100) / 100,
                };
            }
        }
    } catch (e) { errors.push(`er-api: ${e.message}`); }

    // Source 2: frankfurter.dev (ECB rates, free)
    try {
        const r = await fetchWithTimeout('https://api.frankfurter.dev/v1/latest?base=USD&symbols=VES,EUR', 8000);
        if (r.ok) {
            const j = await r.json();
            const usdVes = j?.rates?.VES;
            const eurUsd = j?.rates?.EUR;
            if (usdVes && eurUsd) {
                return {
                    USD: Math.round(usdVes * 100) / 100,
                    EUR: Math.round((usdVes / eurUsd) * 100) / 100,
                };
            }
        }
    } catch (e) { errors.push(`frankfurter: ${e.message}`); }

    // Source 3: dolarapi.com (Venezuela-specific)
    try {
        const r = await fetchWithTimeout('https://ve.dolarapi.com/v1/dolares/oficial', 8000);
        if (r.ok) {
            const j = await r.json();
            const usd = j?.promedio ?? j?.price;
            if (usd) {
                return {
                    USD: Math.round(Number(usd) * 100) / 100,
                    EUR: Math.round(Number(usd) * 1.08 * 100) / 100,
                };
            }
        }
    } catch (e) { errors.push(`dolarapi: ${e.message}`); }

    throw new Error(`All BCV sources failed: ${errors.join(' | ')}`);
}

async function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        const r = await fetch(url, { signal: controller.signal });
        return r;
    } finally {
        clearTimeout(id);
    }
}

module.exports = router;
