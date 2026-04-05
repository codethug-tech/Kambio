const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { refreshAndStore } = require('../lib/bcv');

/** Max age (ms) before we consider stored rates stale and re-fetch. */
const STALE_MS = 5 * 60 * 1000; // 5 minutes — matches backend cron cadence

/**
 * GET /api/rates
 * Returns current BCV exchange rates.
 * If the DB is empty OR the newest rate is older than STALE_MS,
 * a live BCV fetch is triggered first so callers always get fresh data.
 */
router.get('/', async (req, res) => {
    // 1. Read whatever is currently in the DB
    const { data, error } = await supabase
        .from('exchange_rates')
        .select('currency, rate, source, updated_at')
        .order('currency');

    if (error) return res.status(500).json({ error: error.message });

    // 2. Decide if we need a live refresh
    const isEmpty = !data || data.length === 0;
    const newestTs = data
        ?.map(r => new Date(r.updated_at).getTime())
        .reduce((a, b) => Math.max(a, b), 0) ?? 0;
    const isStale = Date.now() - newestTs > STALE_MS;

    if (isEmpty || isStale) {
        // Refresh in the background — if it succeeds, return fresh rows
        const fresh = await refreshAndStore();
        if (fresh) {
            const now = new Date().toISOString();
            return res.json([
                { currency: 'USD', rate: fresh.USD, source: 'BCV', updated_at: now },
                { currency: 'EUR', rate: fresh.EUR, source: 'BCV', updated_at: now },
            ]);
        }
        // refresh failed — fall through and return whatever is in the DB
    }

    res.json(data);
});

/**
 * POST /api/rates/refresh
 * Triggers a live fetch from BCV-compatible sources and updates the DB.
 */
router.post('/refresh', async (req, res) => {
    try {
        const rates = await refreshAndStore();
        if (!rates) throw new Error('All BCV sources failed');
        const now = new Date().toISOString();
        res.json({ ok: true, rates, updated_at: now });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

module.exports = router;
